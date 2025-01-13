import inspect
import json
from datetime import datetime
import os
from dotenv import load_dotenv
from src.utils.common import read_json_from_file, get_api_key

load_dotenv()
OPENAI_API_KEY = get_api_key("OPENAI_API_KEY")

def debug_print(debug: bool, *args: str) -> None:
    if not debug:
        return
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    message = " ".join(map(str, args))
    print(f"\033[97m[\033[90m{timestamp}\033[97m]\033[90m {message}\033[0m")

def merge_fields(target, source):
    for key, value in source.items():
        if isinstance(value, str):
            target[key] += value
        elif value is not None and isinstance(value, dict):
            merge_fields(target[key], value)


def merge_chunk(final_response: dict, delta: dict) -> None:
    delta.pop("role", None)
    merge_fields(final_response, delta)

    tool_calls = delta.get("tool_calls")
    if tool_calls and len(tool_calls) > 0:
        index = tool_calls[0].pop("index")
        merge_fields(final_response["tool_calls"][index], tool_calls[0])


def function_to_json(func) -> dict:
    """
    Converts a Python function into a JSON-serializable dictionary
    that describes the function's signature, including its name,
    description, and parameters.

    Args:
        func: The function to be converted.

    Returns:
        A dictionary representing the function's signature in JSON format.
    """
    type_map = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
        list: "array",
        dict: "object",
        type(None): "null",
    }

    try:
        signature = inspect.signature(func)
    except ValueError as e:
        raise ValueError(
            f"Failed to get signature for function {func.__name__}: {str(e)}"
        )

    parameters = {}
    for param in signature.parameters.values():
        try:
            param_type = type_map.get(param.annotation, "string")
        except KeyError as e:
            raise KeyError(
                f"Unknown type annotation {param.annotation} for parameter {param.name}: {str(e)}"
            )
        parameters[param.name] = {"type": param_type}

    required = [
        param.name
        for param in signature.parameters.values()
        if param.default == inspect._empty
    ]

    return {
        "type": "function",
        "function": {
            "name": func.__name__,
            "description": func.__doc__ or "",
            "parameters": {
                "type": "object",
                "properties": parameters,
                "required": required,
            },
        },
    }

def get_current_turn_messages(messages, only_user = False):
    if only_user:
        return [msg for msg in messages if msg.get("current_turn") and msg.get("role") == "user"]
    else:
        return [msg for msg in messages if msg.get("current_turn")]

def arrange_messages_keys_in_order(messages):
    """Arranges message keys in a specific order: id, role, sender, relevant_agents, content, created_at, timestamp, followed by rest alphabetically"""
    key_order = ['role', 'sender', 'content', 'created_at']
    
    def sort_keys(message):
        # Create new dict with specified key order
        ordered = {}
        # Add keys in specified order if they exist
        for key in key_order:
            if key in message:
                ordered[key] = message[key]
        # Add remaining keys in alphabetical order
        for key in sorted(message.keys()):
            if key not in key_order:
                ordered[key] = message[key]
        return ordered

    return [sort_keys(message) for message in messages]

def remove_irrelevant_messages(messages):
    """Removes all messages from and including the latest user message"""
    for i in range(len(messages)-1, -1, -1):
        if messages[i].get("role") == "user":
            return messages[:i]
    return messages

def update_histories(active_agent, message):
    active_agent.history.append(message)
    return active_agent

def remove_none_fields(message):
    return {k: v for k, v in message.items() if v is not None}

def add_message_metadata(message, active_agent):
    message = remove_none_fields(message)
    message["created_at"] = datetime.now().isoformat()
    message["current_turn"] = True

    if active_agent.respond_to_user:
        message["response_type"] = "external"
    else:
        message["response_type"] = "internal"

    return message

def check_and_remove_repeat_tool_call_to_child(agent, messages):
    # If in the current turn, the most recent assistant message (need not be the last message overall, just needs to be the last message with role as assistant) is a tool call from a child agent, which transfers control to the agent using its parent function, then remove the tool call to transfer to that child again from this agent. This is to prevent back and forth between this agent and the child agent.
    for message in reversed(messages):
        if message.get("role") == "assistant" and message.get("sender") in agent.children_names and message.get("tool_calls"):
            tool_call = message.get("tool_calls")[0]
            child_agent = agent.children.get(message.get("sender"), None)
            if not child_agent:
                continue
            child_agent_name = child_agent.name
            if tool_call.get("function").get("name") == child_agent.parent_function:
                agent.children_names.remove(child_agent_name)
                agent.children.pop(child_agent_name)
                agent.child_functions.pop(child_agent_name)
                break
    return agent

def update_tokens_used(provider, model, tokens_used, completion):
    provider_model = f"{provider}/{model}"
    input_tokens = completion.usage.prompt_tokens
    output_tokens = completion.usage.completion_tokens
    
    if provider_model not in tokens_used:   
        tokens_used[provider_model] = {
            'input_tokens': 0,
            'output_tokens': 0,
        }
    
    tokens_used[provider_model]['input_tokens'] += input_tokens
    tokens_used[provider_model]['output_tokens'] += output_tokens
    
    return tokens_used