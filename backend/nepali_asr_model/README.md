
# Welcome to the Nepali Whisper Model for Automatic Speech Recognition

Hey there! If you’re looking to transcribe Nepali audio into text, you’ve come to the right place. I’ve fine-tuned the Whisper small model specifically for Nepali speech recognition. Below, you’ll find all the details you need to get started, including where to find the datasets and notebooks!

## 🌟 Model Overview
- **Model Name**: Whisper Small
- **Language**: Nepali
- **Current Error Rate**: 30 (achieved after training for 30 epochs)
  
### Where to Find the Good Stuff
- **Dataset**: I created a combined dataset for Nepali language transcription, which you can access [here on Hugging Face](https://huggingface.co/datasets/amitpant7/nepali-speech-to-text).
- **Training Notebook**: Curious about how I trained this model? Check out my [Kaggle Notebook](https://www.kaggle.com/code/amieeeet/whispher-finetune-on-np) to see all the steps I took!

## 🔧 How to Use This Model
Using this model is pretty straightforward! Here’s a quick guide to get you up and running:

### Step 1: Install Required Libraries
Before we dive in, make sure you have the necessary libraries installed. Open your terminal or notebook and run:
```bash
!pip install torch transformers yt-dlp
```

### Step 2: Load the Model
To get started with transcribing audio, you’ll need to load the Whisper model using the Hugging Face `transformers` library. Here’s how:

```python
from transformers import pipeline

# Load the Whisper model for automatic speech recognition
pipe = pipeline("automatic-speech-recognition", model="amitpant7/whisper-small-nepali")
```

### Step 3: Transcribe an Audio File
If you have an audio file ready, you can transcribe it easily. Just point to your audio file (like `audio.mp3`) and run the following:

```python
# Run inference on an audio file
result = pipe('audio.mp3')
print(result['text'])  # This will print the transcribed text
```

### Step 4: Download and Transcribe YouTube Audio
Want to transcribe audio from a YouTube video? No problem! Use the following code to download the audio and transcribe it:

```python
import yt_dlp

def download_youtube_audio(youtube_url, output_path="audio"):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([youtube_url])
    return output_path

# Replace with the actual YouTube URL
youtube_url = "https://www.youtube.com/watch?v=H-ExNmHo2xI&pp=ygURYWJvdXQgeWFtYSBidWRkaGE%3D"
audio_file = download_youtube_audio(youtube_url)

# Now, run inference on the downloaded audio
result = pipe(audio_file)
print(result['text'])
```

### 📝 A Few Things to Keep in Mind
- The model works best with clear audio, so try to avoid noisy environments when recording.
- Performance may vary based on accents and pronunciation, but the model is designed to handle a variety of speech patterns.
