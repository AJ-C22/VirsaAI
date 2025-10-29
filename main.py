import whisper
import ollama
from ollama import chat
from ollama import ChatResponse


def transcribe_audio(audio_file):
    model = whisper.load_model("medium", device="cpu")
    result = model.transcribe(audio_file, task="translate")
    return result["text"]

def parse_text(transcript):
    prompt = f"""
        Repeat the exact following text, alternating capital and lowercase for every letter.
        Do not summarize, interpret, or add any extra words. 
        Only return the transformed text itself.

        Text:
        {transcript}
        """
    response: ChatResponse = chat(model='mistral', messages=[
        {
            'role': 'user',
            'content': prompt,
        },
    ])
    print(response["message"]["content"])

def main():
    text = transcribe_audio("punjabi_test.wav")
    parse_text(text)

if __name__ == "__main__":
    main()
