from src.utils.common import common_logger
logger = common_logger
from .access import get_agent_data_by_name

def reset_current_turn(messages):
    # Set all messages' current_turn to False
    for msg in messages:
        msg["current_turn"] = False
        
    # Find most recent user message
    messages[-1]["current_turn"] = True
            
    return messages

def reset_current_turn_agent_history(agent_data, agent_names):
    for name in agent_names:
        data = get_agent_data_by_name(name, agent_data)
        if data:
            for msg in data["history"]:
                msg["current_turn"] = False
    return agent_data

def add_recent_messages_to_history(recent_messages, last_agent_name, agent_data, messages, parent_has_child_history):
    last_msg = messages[-1]
    specific_agent_data = get_agent_data_by_name(last_agent_name, agent_data)
    if specific_agent_data:
        specific_agent_data["history"].extend(recent_messages)
        if parent_has_child_history:
            current_agent_data = specific_agent_data
            while current_agent_data.get("most_recent_parent_name"):
                parent_name = current_agent_data.get("most_recent_parent_name")
                parent_agent_data = get_agent_data_by_name(parent_name, agent_data)
                if parent_agent_data:
                    parent_agent_data["history"].extend(recent_messages)
                    current_agent_data = parent_agent_data
                else:
                    logger.error(f"Parent agent data for {current_agent_data['name']} not found in agent_data")
                    raise ValueError(f"Parent agent data for {current_agent_data['name']} not found in agent_data")
    else:
        agent_data.append({
            "name": last_agent_name,
            "history": [last_msg]
        })

    return agent_data

def construct_state_from_response(response, agents):
    agent_data = []
    for agent in agents:
        agent_data.append({
            "name": agent.name,
            "instructions": agent.instructions,
            "parent_function": agent.parent_function.__name__ if agent.parent_function else None,
            "child_functions": [f.__name__ for f in agent.child_functions.values()] if agent.child_functions else [],
            "internal_tools": [t.get("function").get("name") for t in agent.internal_tools] if agent.internal_tools else [],
            "external_tools": [t.get("function").get("name") for t in agent.external_tools] if agent.external_tools else [],
            "history": agent.history,
            "most_recent_parent_name": agent.most_recent_parent.name if agent.most_recent_parent else ""
        })

    state = {
        "last_agent_name": response.agent.name,
        "agent_data": agent_data
    }

    return state