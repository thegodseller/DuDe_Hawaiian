from src.utils.common import common_logger, read_json_from_file
import requests
import json
import argparse
from datetime import datetime

logger = common_logger
logger.info("Running app_client_streaming.py")

def preprocess_messages(messages):
    # Preprocess messages to handle null content and role issues
    for msg in messages:
        # Handle null content in assistant messages with tool calls
        if (msg.get("role") == "assistant" and 
            msg.get("content") is None and 
            msg.get("tool_calls") is not None and 
            len(msg.get("tool_calls")) > 0):
            msg["content"] = "Calling tool"
            
        # Handle role issues
        if msg.get("role") == "tool":
            msg["role"] = "developer"
        elif not msg.get("role"):
            msg["role"] = "user"
    
    return messages

def stream_chat(host, request_data, api_key):
    start_time = datetime.now()
    print("\n" + "="*80)
    print(f"Starting streaming chat at {start_time}")
    print(f"Host: {host}")
    print("="*80 + "\n")

    # First, initialize the stream
    try:
        print("\n" + "-"*80)
        print("Initializing stream...")
        init_response = requests.post(
            f"{host}/chat_stream_init",
            json=request_data,
            headers={'Authorization': f'Bearer {api_key}'}
        )
        print(f"Init Response Status: {init_response.status_code}")
        print(f"Init Response Text: {init_response.text}")
        print("-"*80 + "\n")
        
        if init_response.status_code != 200:
            logger.error(f"Error initializing stream. Status code: {init_response.status_code}")
            logger.error(f"Response: {init_response.text}")
            return
            
        init_data = init_response.json()
        
        if 'error' in init_data:
            logger.error(f"Error initializing stream: {init_data['error']}")
            return
        
        stream_id = init_data['stream_id']
        print(f"Stream initialized successfully with ID: {stream_id}")
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error during stream initialization: {e}")
        return
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON response: {e}")
        logger.error(f"Raw response: {init_response.text}")
        return
    
    # Now connect to the stream
    try:
        print("\n" + "-"*80)
        print(f"Connecting to stream {stream_id}...")
        stream_response = requests.get(
            f"{host}/chat_stream/{stream_id}",
            headers={
                'Authorization': f'Bearer {api_key}',
                'Accept': 'text/event-stream'
            },
            stream=True
        )
        
        if stream_response.status_code != 200:
            logger.error(f"Error connecting to stream. Status code: {stream_response.status_code}")
            logger.error(f"Response: {stream_response.text}")
            return
            
        print(f"Successfully connected to stream")
        print("-"*80 + "\n")

        event_count = 0
        current_data = []
        
        try:
            print("\n" + "-"*80)
            print("Starting to process events...")
            print("-"*80 + "\n")
            
            for line in stream_response.iter_lines(decode_unicode=True):
                if line:
                    if line.startswith('data: '):
                        data = line[6:]  # Remove 'data: ' prefix
                        try:
                            event_data = json.loads(data)
                            event_count += 1
                            print("\n" + "*"*80)
                            print(f"Event #{event_count}")
                            
                            if isinstance(event_data, dict):
                                # Pretty print the event data
                                print("Event Data:")
                                print(json.dumps(event_data, indent=2))
                                
                                # Special handling for message events
                                if 'content' in event_data:
                                    print("\nMessage Content:", event_data['content'])
                                    if event_data.get('tool_calls'):
                                        print("Tool Calls:", json.dumps(event_data['tool_calls'], indent=2))
                            else:
                                print("Event Data:", event_data)
                            print("*"*80 + "\n")
                            
                        except json.JSONDecodeError as e:
                            print(f"Error decoding event data: {e}")
                            print(f"Raw data: {data}")
                
        except Exception as e:
            print(f"Error processing stream: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\n" + "-"*80)
            print(f"Closing stream after processing {event_count} events")
            print("-"*80 + "\n")
            stream_response.close()
            
    except requests.exceptions.RequestException as e:
        print(f"Request error during streaming: {e}")
        import traceback
        traceback.print_exc()

    end_time = datetime.now()
    duration = end_time - start_time
    print("\n" + "="*80)
    print(f"Streaming session completed at {end_time}")
    print(f"Total duration: {duration}")
    print("="*80 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--sample_request', type=str, required=False, default='tmp.json',
                       help='Sample request JSON file name under tests/sample_requests/')
    parser.add_argument('--api_key', type=str, required=False, default='test',
                       help='API key to use for authentication')
    parser.add_argument('--host', type=str, default='http://localhost:4040',
                       help='Host to use for the request')
    args = parser.parse_args()

    try:
        print("\n" + "="*80)
        print("Loading request data...")
        request = read_json_from_file(f"./tests/sample_requests/{args.sample_request}").get("lastRequest", {})
        print("Request data:")
        print(json.dumps(request, indent=2))
        print("Starting streaming request...")
        print("="*80 + "\n")
        
        stream_chat(args.host, request, args.api_key)
    except Exception as e:
        print("\n" + "!"*80)
        print(f"Error in main: {e}")
        import traceback
        traceback.print_exc()
        print("!"*80 + "\n")
