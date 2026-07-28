from ollama import chat
from ollama import ChatResponse
import os
from dotenv import load_dotenv
from db.db_operations import save_complete_story
from pipeline import transcribe_audio, parse_text_gemini, extract_key_data


def parse_text(transcript):
    print("Organizing text with AI...")
    prompt = f"""
        You are VirsaAI — a thoughtful archivist that organizes real spoken life stories
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
