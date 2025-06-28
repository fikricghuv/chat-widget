## Development server

To start a local development server docker, run:

ng build --configuration production
docker build -t chat-widget-ui .
docker compose up --build -d


Once the server is running, open your browser and navigate to `http://localhost:4201/`. The application will automatically reload whenever you modify any of the source files.

