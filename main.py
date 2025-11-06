import whisper
import ollama
from ollama import chat
from ollama import ChatResponse
import time
import os
from dotenv import load_dotenv
from google import genai
from db_operations import save_story

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


def main():
    load_dotenv()
    API_KEY = os.getenv("GEMINI_KEY")

    start_time = time.time()
    text = transcribe_audio("life_story_one_min.mp3")
    parse_text_gemini(text, API_KEY)
    end_time = time.time()

    time_elapsed = end_time - start_time
    print(f"\nTime Elapsed: {time_elapsed}")

if __name__ == "__main__":
    main()
