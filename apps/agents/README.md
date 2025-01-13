## Agents
Please visit https://www.rowboatlabs.com/developers to learn more about RowBoat Labs for developers

## Set up conda env
- `conda create -n myenv python=3.12`
- `conda activate myenv`
- Note: python>=3.10

## Install dependencies
Install either using poetry or using pip

### Using poetry
- `pip install poetry`
- `poetry install`

### Using pip
`pip install -r requirements.txt`

## Set up .env file
Copy `.env.copy` to `.env` and add your API keys

## Run interactive test
`python -m tests.interactive --config default_config.json --sample_request default_example.json --load_messages`
- `--config`: Config json filename, under `configs` folder
- `--sample_request`: Path to the sample request file, under `tests/sample_requests` folder
- `--load_messages`: If set, it will additionally load the initial set of messages from the sample request file. Else, user input will be required starting from the first message.

## Set up app server

- For local testing: `flask --app src.app.main run --port=4040`
- To set up the server on remote: `gunicorn -b 0.0.0.0:4040 src.app.main:app`

## Run client test
`python -m tests.app_client`