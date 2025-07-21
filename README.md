# Anime Generation Tool

## Overview
The Anime Generation Tool is a standalone, Dockerized application that allows users to generate anime scenes based on text input. The tool features a web UI for user interaction, enabling the selection of backgrounds, characters, voices, and background music (BGM). It utilizes advanced models for scene parsing and text-to-speech (TTS) generation, and it renders videos with animated characters.

## Project Structure
The project is organized into several components, each running in its own Docker container:

- **web-ui**: The front-end application built with React, providing the user interface for interaction.
- **scene-parser**: A Python service that parses user text into scenes/scripts using the `qwen2-1_5b-instruct-q4_k_m.gguf` model.
- **tts**: A Python service that generates TTS audio locally using Edge TTS.
- **video-renderer**: A Python service that renders a "talking head" video by cycling through pre-made GIF expressions and applying camera moves.
- **assets**: Contains all necessary assets such as backgrounds, characters, voices, and BGM.
- **scripts**: Contains the entrypoint script for orchestrating the startup of the various components.

## Setup Instructions

### Prerequisites
- Docker
- Docker Compose

### Building and Running the Application
1. Clone the repository:
   ```
   git clone <repository-url>
   cd anime-gen-tool
   ```

2. Build and start the Docker containers:
   ```
   docker-compose up --build
   ```

3. Access the web UI:
   Open your web browser and navigate to `http://localhost:3000`.

## Usage
1. Enter your text in the provided input field.
2. Select the desired backgrounds, characters, voices, and BGM from the available options.
3. Click on the "Generate" button to create the anime scene.
4. The tool will process the input and generate a final MP4 video that can be downloaded.

## Components
- **Web UI**: Built with React, allows users to interact with the tool.
- **Scene Parser**: Parses user input into structured scenes/scripts.
- **TTS**: Converts text to speech for character dialogues.
- **Video Renderer**: Combines audio and visuals to create the final video output.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License. See the LICENSE file for details.