import whisper
import ollama
from ollama import chat
from ollama import ChatResponse
import time
import os
import json
from dotenv import load_dotenv
from google import genai
from db.db_operations import save_story, save_complete_story

def transcribe_audio(audio_file):
    print("Transcribing audio...")
    model = whisper.load_model("small", device="cpu")
    result = model.transcribe(audio_file, task="translate")
    return result["text"]

def parse_text(transcript):
    print("Organizing text with AI...")
    prompt = f"""
        You are VisraAI — a thoughtful archivist that organizes real spoken life stories
        into clear, readable sections that reflect the person’s journey.

        ### Your task:

        Organize the following transcript into a structured family biography written in a warm but factual tone. 
        Focus on clarity, chronological flow, and emotional truth.Use section headers like ‘Early Life in Punjab,’ 
        ‘Migration to Canada,’ and ‘Family & Legacy.’ Add historical or cultural context where relevant (e.g., local traditions, 
        global events, immigration era). Preserve personal quotes or expressions exactly as spoken. Include small reflections that 
        connect past and present generations. Avoid exaggeration — keep it natural and documentary-style, suitable for a family 
        history archive.

        ### Instructions:
        1. Identify logical story sections — for example: "Childhood Memories", "Moving Abroad",
        "Raising a Family", "Faith and Community", "Reflections", etc.
        Choose headings that best describe the actual content.

        2. Summarize what was said in each section in clear English paragraphs.
        - Keep it personal and emotional where appropriate.
        - Preserve cultural details, names, and places.
        - Merge overlapping or repeated ideas into one coherent section.

        3. Maintain chronological flow — from earliest memories to later reflections.


        ### Transcript:
        {transcript}
        """
    response: ChatResponse = chat(model='mistral', messages=[
        {
            'role': 'user',
            'content': prompt,
        },
    ])
    print("\nHISTORICAL STORY:\n")
    print(response["message"]["content"])

def parse_text_gemini(transcript, API_KEY):
    print("\nOrganizing text with AI...\n")
    client = genai.Client(api_key=API_KEY)

    prompt = f"""
        You are VisraAI — a thoughtful archivist that organizes real spoken life stories
        into clear, readable sections that reflect the person’s journey.

        ### Your task:

        ### Your ONLY output:
        A **single organized biography** with section headers. 
        DO NOT repeat, rewrite, or include the transcript in raw form.
        DO NOT output anything before or after the biography.
        DO NOT include 'HISTORICAL STORY:', 'Transcript:', or any headings I did not request.

        Organize the following transcript into a structured family biography written in a warm but factual tone. 
        Focus on clarity, chronological flow, and emotional truth.Use section headers like ‘Early Life in Punjab,’ 
        ‘Migration to Canada,’ and ‘Family & Legacy.’ Add historical or cultural context where relevant (e.g., local traditions, 
        global events, immigration era). Preserve personal quotes or expressions exactly as spoken. Include small reflections that 
        connect past and present generations. Avoid exaggeration — keep it natural and documentary-style, suitable for a family 
        history archive.

        ### Instructions:
        1. Identify logical story sections — for example: "Childhood Memories", "Moving Abroad",
        "Raising a Family", "Faith and Community", "Reflections", etc.
        Choose headings that best describe the actual content.

        2. Summarize what was said in each section in clear English paragraphs.
        - Keep it personal and emotional where appropriate.
        - Preserve cultural details, names, and places.
        - Merge overlapping or repeated ideas into one coherent section.

        3. Maintain chronological flow — from earliest memories to later reflections.


        ### Transcript:
        {transcript}
        """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    organized_story = response.text.strip()

    print("\nHISTORICAL STORY:\n")
    print(organized_story)

    return organized_story


def extract_key_data(transcript, API_KEY):
    print("\nExtracting JSON...\n")
    client = genai.Client(api_key=API_KEY)

    prompt = f"""
        You are an information extraction system for life story archiving.

        Your job is to convert a raw life story transcript into a structured JSON object optimized for:
        - Timeline visualization (chronological events with dates)
        - Family tree construction (relationships and family members)
        - Data storage and retrieval (key facts and metadata)

        CRITICAL RULES:
        - DO NOT add anything that is not stated or logically implied in the transcript
        - If dates are missing, infer approximate years from context clues (e.g., "when I was 12", "in the 1960s")
        - Use null for unknown dates/years, not guesses
        - Keep all text concise and factual
        - All output MUST be valid JSON only (no markdown, no explanations)

        Extract the following structured data:

        1. "summary": A 2–3 sentence summary of the life story.

        2. "person_info": Basic information about the main person (the storyteller):
           {{
             "birth_year": Integer or null,
             "birth_place": String or null,
             "death_year": Integer or null (if mentioned),
             "name": String or null (if mentioned in third person)
           }}

        3. "timeline_events": Chronological list of ONLY the most significant and note-worthy events that would be seen in a timeline.
           
           INCLUDE events like:
           - Major life transitions (birth, immigration, marriage, death)
           - Significant achievements (graduation, career milestones, awards)
           - Important family events (birth of children, family reunions, losses)
           - Major moves or relocations
           - Historical or cultural milestones that affected the person
           
           EXCLUDE routine or minor events like:
           - Daily activities, regular work days, casual conversations
           - Minor trips or visits unless they were life-changing
           - Routine celebrations or holidays (unless specifically significant)
           - Vague memories without clear dates or importance
           
           Each event includes:
           {{
             "year": Integer or null,
             "event": String (concise title/summary of event),
             "description": String (longer description with more context),
             "location": String or null (where it happened),
             "category": String (e.g., "birth", "immigration", "marriage", "education", "career", "family", "milestone")
           }}

        4. "family_members": People mentioned with their relationships (for family tree).
           Each person includes:
           {{
             "name": String,
             "relationship": String (e.g., "father", "mother", "spouse", "child", "sibling", "grandparent", "aunt", "uncle", "cousin"),
             "birth_year": Integer or null,
             "death_year": Integer or null,
             "notes": String or null (brief context about this person)
           }}

        5. "locations": Places where the person lived or spent significant time.
           Each location includes:
           {{
             "place": String (city, region, or country),
             "start_year": Integer or null,
             "end_year": Integer or null,
             "purpose": String or null (e.g., "birthplace", "childhood home", "immigration destination", "work")
           }}

        6. "occupations": Career or work history (if mentioned).
           Each occupation includes:
           {{
             "role": String (job title or occupation),
             "start_year": Integer or null,
             "end_year": Integer or null,
             "location": String or null (where they worked)
           }}

        7. "themes": Key themes or topics (for searchability).
           Array of strings (e.g., ["immigration", "family", "education", "resilience", "faith", "community"])

        OUTPUT REQUIREMENTS:
        - Return ONLY valid JSON (no markdown, no code blocks, no explanations)
        - Use null for missing/unknown values
        - Use empty arrays [] if a section has no data
        - Include all fields described above in the JSON structure

        Here is the raw life story transcript:
        {transcript}
    """
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    
    print("\nJSON:\n")
    print(response.text)
    
    # Parse the JSON response
    try:
        json_text = response.text.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]  
        if json_text.startswith("```"):
            json_text = json_text[3:]  
        if json_text.endswith("```"):
            json_text = json_text[:-3]  
        
        json_text = json_text.strip()
        extracted_data = json.loads(json_text)
        return extracted_data
    except json.JSONDecodeError as e:
        print(f"\nError parsing JSON: {e}")
        print(f"Raw response: {response.text}")
        return None


def main():
    load_dotenv()
    API_KEY = os.getenv("GEMINI_KEY")

    # 1. TRANSCRIBE AUDIO
    text = transcribe_audio("audio_files/life_story_2.mp3")

    # 2. ORGANIZE INTO A FULL BIOGRAPHY
    organized_story = parse_text_gemini(text, API_KEY)

    # 3. EXTRACT STRUCTURED JSON
    extracted_data = extract_key_data(text, API_KEY)

    if extracted_data:
        summary = extracted_data.get("summary")

        person_name = extracted_data.get("person_info", {}).get("name") or "Unknown"

        final_id = save_complete_story(
            person_name=person_name,
            raw_body=text,
            story=organized_story,
            summary=summary,
            extracted_data=extracted_data
        )

        if final_id:
            print(f"\n✓ Complete story saved with ID: {final_id}")
        else:
            print("\n✗ Failed to save complete story")

if __name__ == "__main__": 
    main()
