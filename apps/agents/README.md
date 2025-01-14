# RowBoat Labs
Please visit https://www.rowboatlabs.com to learn more about RowBoat Labs

# Agents

## Overview
- RowBoat Agents is a multi-agent framework which powers conversations based on agentic workflows.
- The Rowboat Agents framework has been built upon [OpenAI Swarm](https://github.com/openai/swarm), with modifications and improvements. Please see the `NOTICE.md` file in this directory, for attribution notes and more details. OpenAI Swarm is available under the MIT license as of the time of this writing.

## Graph-based framework
- Multi-agent systems are typically implemented as graphs, where each agent is a node in the graph. 
- RowBoat Agents is a stateless implementation of such a graph-based system (specifically, a DAG or directed acyclic graph).
- At every turn of conversation, the graph is traversed based on `messages`, `state` and `workflow` (which defines the agents, tools and connections between them)
- `Workflows` can be configured in the no-code RowBoat Studio (UI) with the assistance of an AI copilot. Instructions to set up the Studio can be found in the [main README](https://github.com/rowboatlabs/rowboat/tree/dev).
- At each turn of conversation, the agent graph object is created from scratch. The graph is then run, which produces the next set of `messages` and `state`. The `messages` will be shown to the user by the upstream service. Additionally, if the `messages` contain tool calls, then the upstream service must invoke the necessary tools and send the results back to the framework as the next turn.

## Key request and response fields

### Request
- `messages`: List of messages from the user
- `state`: Represents the currently active agent and agent-level histories
- `workflow`: Represents the graph of agents, tools and connections between them

Note: See `tests/sample_requests/default_example.json` for an example of a complete request JSON

### Response
- `messages`: List of response messages (which might have tool calls to be invoked)
- `state`: New state of the conversation which is to be passed back during invocation of the next turn, since the framework itself is stateless

Note: See `tests/sample_responses/default_example.json` for an example of a complete response JSON

# Using the framework

## Set up conda env
Standard conda env setup process:
- `conda create -n myenv python=3.12`
- `conda activate myenv`
- Note: python>=3.10

## Install dependencies
Install either using poetry or using pip

### If using poetry
- `pip install poetry`
- `poetry install`

### If using pip
`pip install -r requirements.txt`

## Set up .env file
Copy `.env.example` to `.env` and add your API keys

## Run interactive test
`python -m tests.interactive --config default_config.json --sample_request default_example.json --load_messages`
- `--config`: Config json filename, under `configs` folder
- `--sample_request`: Path to the sample request file, under `tests/sample_requests` folder
- `--load_messages`: If set, it will additionally load the initial set of messages from the sample request file. Else, user input will be required starting from the first message.

## Set up app server

- For local testing: `flask --app src.app.main run --port=4040`
- To set up the server on remote: `gunicorn -b 0.0.0.0:4040 src.app.main:app`

## Run test client
`python -m tests.app_client --sample_request default_example.json`
- `--sample_request`: Path to the sample request file, under `tests/sample_requests` folder

# More details

## Specifics
- **Format**: Uses OpenAI's messages format when passing messages. 
- **LLMs**: Currently, only OpenAI LLMs (e.g. gpt-4o, gpt-4o-mini) are supported. Easy to expand to other LLMs like Claude, Gemini or self-hosted models.
- **Responses**: Here are some examples of responses that the framework can return:
  - A list of one user-facing message
  - A list of one or more tool calls
  - A list of one user-facing message and one or more tool calls
- **Errors**: Errors are thrown as a tool call `raise_error` with the error message as the argument. Real-time error handling will be managed by the upstream service. 

## Important directories and files
- `src/`: Contains all source code for the agents app
  - `src/app/`: Contains Flask app which exposes the framework as a service
  - `src/graph/`: Contains logic to run every turn of the conversation
    - `src/graph/core.py`: Core graph implementation which parses the workflow config, creates agents from it and runs the turn of conversation (through the `run_turn` function)
  - `src/swarm/`: RowBoat's custom implementation of OpenAI Swarm, which is used by `src/graph/core.py`
- `tests/`: Contains sample requests, an interactive client and a test client which mocks an upstream service
- `configs/`: Contains graph configurations (changed infrequently)
- `tests/sample_requests/`: Contains sample request files for the agents app

## High-level flow
- `app/main.py` receives the request JSON from an upstream service, parses it and sends it to `src/graph/core.py`
- `src/graph/core.py` creates the agent graph object from scratch and uses `src/swarm/core.py` to run the turn
- `src/swarm/core.py` runs the turn by performing actual LLM calls and internal tool invocations to transitiion between agents
- `src/graph/core.py` returns the response messages and the new state to `app/main.py`, which relays it back to the upstream service
- The upstream services appends any new user messages to the history of messages and sends the messages back along with the new state to `app/main.py` as part of the next request. The process repeats until the upstream service completes its conversation with the user.

## Limitations
- Does not support streaming currently.
- Cannot respond with multiple user-facing messages in the same turn.