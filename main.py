import whisper
import ollama
from ollama import chat
from ollama import ChatResponse
import time
import os
import json
from dotenv import load_dotenv
from google import genai
from db.db_operations import save_story

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

        Organize the following transcript into a structured family biography written in a warm but factual tone. 
        Focus on clarity, chronological flow, and emotional truth.Use section headers like ‘Early Life in Punjab,’ 
        ‘Migration to Canada,’ and ‘Family & Legacy.’ Add historical or cultural context where relevant (e.g., local traditions, 
        global events, immigration era). Preserve personal quotes or expressions exactly as spoken. Include small reflections that 
        connect past and present generations. Avoid exaggeration — keep it natural and documentary-style, suitable for a family 
        history archive.

        TONE: Keep the tone in the voice of the reader. Serious, not like a book but a narrated, to the point story of someone's life (like britannica 
        where the facts and history is the most important thing, not the "story" or creative narration). Don't use quotes from the audio file.
        You essentially want to turn the first person narration -> third person with similiar tone.

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

    print("\nHISTORICAL STORY:\n")
    print(response.text)
    
    # Save the story to the database
    story_id = save_story(
        title="Life Story Transcript",
        body=response.text
    )
    if story_id:
        print(f"\nStory saved to database with ID: {story_id}")
    else:
        print("\nFailed to save story to database")

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

        3. "timeline_events": Chronological list of significant and note-worthy events for timeline visualization.
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

    start_time = time.time()
    text = transcribe_audio("audio_files/life_story_one_min.mp3")
    parse_text_gemini(text, API_KEY)
    end_time = time.time()

    time_elapsed = end_time - start_time
    print(f"\nTime Elapsed: {time_elapsed}")
    
    extracted_data = extract_key_data(text, API_KEY)
    if extracted_data:
        print("\nExtracted Data Summary:")
        print(f"  Summary: {extracted_data.get('summary', 'N/A')[:100]}...")
        print(f"  Timeline Events: {len(extracted_data.get('timeline_events', []))}")
        print(f"  Family Members: {len(extracted_data.get('family_members', []))}")
        print(f"  Locations: {len(extracted_data.get('locations', []))}")
        print(f"  Occupations: {len(extracted_data.get('occupations', []))}")
        print(f"  Themes: {extracted_data.get('themes', [])}")

if __name__ == "__main__":
    main()
