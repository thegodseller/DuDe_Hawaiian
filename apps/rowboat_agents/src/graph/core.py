import traceback
from copy import deepcopy
from datetime import datetime
import json
import uuid
import logging
from .helpers.access import (
    get_agent_by_name,
    get_external_tools,
    get_prompt_by_type
)
from .helpers.library_tools import handle_web_search_event
from .helpers.control import get_last_agent_name
from .swarm_wrapper import run_streamed as swarm_run_streamed, get_agents
from src.utils.common import common_logger as logger

from .types import PromptType, VisibilityType, ControlType

# Create a dedicated logger for swarm wrapper
logger.setLevel(logging.INFO)
print("Logger level set to INFO")

def order_messages(messages):
    """
    Sorts each message's keys in a specified order and returns a new list of ordered messages.
    """
    ordered_messages = []
    for msg in messages:
        # Filter out None values
        msg = {k: v for k, v in msg.items() if v is not None}

        # Specify the exact order
        ordered = {}
        for key in ['role', 'sender', 'content', 'created_at', 'timestamp']:
            if key in msg:
                ordered[key] = msg[key]

        # Add remaining keys in alphabetical order
        remaining_keys = sorted(k for k in msg if k not in ordered)
        for key in remaining_keys:
            ordered[key] = msg[key]

        ordered_messages.append(ordered)
    return ordered_messages

def set_sys_message(messages):
    """
    If the system message is empty, set it to the default message: "You are a helplful assistant."
    """
    if messages[0].get("role") == "system" and messages[0].get("content") == "":
        messages[0]["content"] = "You are a helpful assistant."
        print("Updated system message: ", messages[0])
        logger.info("Updated system message: ", messages[0])
        print("Messages: ", messages)
        # logger.info("Messages: ", messages)
    
    return messages

def handle_web_search_event(event, current_agent):
    """
    Helper function to handle all web search related events.
    Returns a list of messages to yield.
    """
    messages = []
    
    # Handle raw response web search
    if event.type == "raw_response_event":
        if hasattr(event, 'data') and hasattr(event.data, 'raw_item'):
            raw_item = event.data.raw_item
            if (hasattr(raw_item, 'type') and raw_item.type == 'web_search_call') or (
                isinstance(raw_item, dict) and raw_item.get('type') == 'web_search_call'
            ):
                call_id = None
                if hasattr(raw_item, 'id'):
                    call_id = raw_item.id
                elif isinstance(raw_item, dict) and 'id' in raw_item:
                    call_id = raw_item['id']
                else:
                    call_id = str(uuid.uuid4())

                status = 'unknown'
                if hasattr(raw_item, 'status'):
                    status = raw_item.status
                elif isinstance(raw_item, dict) and 'status' in raw_item:
                    status = raw_item['status']

                messages.append({
                    'content': None,
                    'role': 'assistant',
                    'sender': current_agent.name if current_agent else None,
                    'tool_calls': [{
                        'function': {
                            'name': 'web_search',
                            'arguments': json.dumps({
                                'search_id': call_id,
                                'status': status
                            })
                        },
                        'id': call_id,
                        'type': 'function'
                    }],
                    'tool_call_id': None,
                    'tool_name': None,
                    'response_type': 'internal'
                })

    # Handle run item web search events
    elif event.type == "run_item_stream_event":
        if event.item.type == "tool_call_item":
            if hasattr(event.item.raw_item, 'type') and event.item.raw_item.type == 'web_search_call':
                call_id = event.item.raw_item.id if hasattr(event.item.raw_item, 'id') else str(uuid.uuid4())
                messages.append({
                    'content': None,
                    'role': 'assistant',
                    'sender': current_agent.name if current_agent else None,
                    'tool_calls': [{
                        'function': {
                            'name': 'web_search',
                            'arguments': json.dumps({
                                'search_id': call_id
                            })
                        },
                        'id': call_id,
                        'type': 'function'
                    }],
                    'tool_call_id': None,
                    'tool_name': None,
                    'response_type': 'internal'
                })
                messages.append({
                    'content': "Web search done",
                    'role': 'tool',
                    'sender': None,
                    'tool_calls': None,
                    'tool_call_id': call_id,
                    'tool_name': 'web_search',
                    'response_type': 'internal'
                })

        elif event.item.type == "tool_call_output_item":
            if isinstance(event.item.raw_item, dict) and event.item.raw_item.get('type') == 'web_search_results':
                call_id = event.item.raw_item.get('search_id', event.item.raw_item.get('id', str(uuid.uuid4())))
                messages.append({
                    'content': str(event.item.output),
                    'role': 'tool',
                    'sender': None,
                    'tool_calls': None,
                    'tool_call_id': call_id,
                    'tool_name': 'web_search',
                    'response_type': 'internal'
                })

        elif event.item.type == "web_search_call_item" or (
            hasattr(event.item, 'raw_item') and 
            hasattr(event.item.raw_item, 'type') and 
            event.item.raw_item.type == 'web_search_call'
        ):
            call_id = None
            if hasattr(event.item.raw_item, 'id'):
                call_id = event.item.raw_item.id

            messages.append({
                'content': None,
                'role': 'assistant',
                'sender': current_agent.name if current_agent else None,
                'tool_calls': [{
                    'function': {
                        'name': 'web_search',
                        'arguments': json.dumps({
                            'search_id': call_id
                        })
                    },
                    'id': call_id or str(uuid.uuid4()),
                    'type': 'function'
                }],
                'tool_call_id': None,
                'tool_name': None,
                'response_type': 'internal'
            })

        elif event.item.type == "web_search_results_item" or (
            hasattr(event.item, 'raw_item') and (
                (hasattr(event.item.raw_item, 'type') and event.item.raw_item.type == 'web_search_results') or
                (isinstance(event.item.raw_item, dict) and event.item.raw_item.get('type') == 'web_search_results')
            )
        ):
            raw_item = event.item.raw_item
            call_id = None

            if hasattr(raw_item, 'search_id'):
                call_id = raw_item.search_id
            elif isinstance(raw_item, dict) and 'search_id' in raw_item:
                call_id = raw_item['search_id']
            elif hasattr(raw_item, 'id'):
                call_id = raw_item.id
            elif isinstance(raw_item, dict) and 'id' in raw_item:
                call_id = raw_item['id']
            else:
                call_id = str(uuid.uuid4())

            results = {}
            if hasattr(event.item, 'output'):
                results = event.item.output
            elif hasattr(raw_item, 'results'):
                results = raw_item.results
            elif isinstance(raw_item, dict) and 'results' in raw_item:
                results = raw_item['results']

            results_str = ""
            try:
                results_str = json.dumps(results) if results else ""
            except Exception as e:
                print(f"Error serializing results: {str(e)}")
                results_str = str(results)

            messages.append({
                'content': results_str,
                'role': 'tool',
                'sender': None,
                'tool_calls': None,
                'tool_call_id': call_id,
                'tool_name': 'web_search',
                'response_type': 'internal'
            })

    return messages

""" Example workflow config
{
  "agents": [
    {
      "name": "Credit Card Hub",
      "type": "conversation",
      "description": "Hub agent to route credit card related queries to the appropriate specialized agent.",
      "instructions": "## 🧑‍💼 Role:\nYou are the hub for all credit card related queries. Your job is to understand the user's intent and route their query to the correct specialized agent.\n\n---\n## ⚙️ Steps to Follow:\n1. Greet the user and ask how you can help with their credit card needs.\n2. If the user asks about card recommendations, call [@agent:Card Recommendation](#mention).\n3. If the user asks about card benefits or rewards, call [@agent:Card Benefits and Rewards](#mention).\n4. If the user asks about the application process, call [@agent:Card Application Process](#mention).\n5. If the user asks for general credit card advice, call [@agent:General Credit Card Advice](#mention).\n6. If the query is out of scope, politely inform the user.\n\n---\n## 🎯 Scope:\n✅ In Scope:\n- Routing credit card related queries to the correct agent.\n\n❌ Out of Scope:\n- Answering credit card questions directly.\n- Handling non-credit card queries.\n\n---\n## 📋 Guidelines:\n✔️ Dos:\n- Be professional and friendly.\n- Route queries efficiently.\n\n🚫 Don'ts:\n- Do not answer questions directly.\n- Do not provide user-facing text such as 'I will connect you now...' when calling another agent.",
      "model": "claude-3-7-sonnet-latest",
      "toggleAble": true,
      "ragReturnType": "chunks",
      "ragK": 3,
      "controlType": "retain",
      "examples": "- **User** : Can you recommend a credit card for travel?\n - **Agent actions**: Call [@agent:Card Recommendation](#mention)\n\n- **User** : What are the benefits of the Platinum card?\n - **Agent actions**: Call [@agent:Card Benefits and Rewards](#mention)\n\n- **User** : How do I apply for a credit card?\n - **Agent actions**: Call [@agent:Card Application Process](#mention)\n\n- **User** : Should I get a credit card or a debit card?\n - **Agent actions**: Call [@agent:General Credit Card Advice](#mention)\n\n- **User** : Hi!\n - **Agent response**: Hello! How can I help you with your credit card needs today?"
    },
    {
      "name": "Card Recommendation",
      "type": "conversation",
      "description": "Provides personalized credit card recommendations based on user needs.",
      "disabled": false,
      "instructions": "## 🧑‍💼 Role:\nYou help users find the best credit card for their needs.\n\n---\n## ⚙️ Steps to Follow:\n1. Ask the user about their preferences (e.g., travel, cashback, low interest, rewards).\n2. Use [@tool:web_search](#mention) to find suitable credit card options.\n3. Present 2-3 card recommendations with a brief explanation for each.\n4. If the user asks about benefits or application process, call the relevant agent.\n5. If the query is out of scope, call [@agent:Credit Card Hub](#mention).\n\n---\n## 🎯 Scope:\n✅ In Scope:\n- Recommending credit cards based on user needs.\n\n❌ Out of Scope:\n- Detailed card benefits (refer to Card Benefits and Rewards agent).\n- Application process (refer to Card Application Process agent).\n\n---\n## 📋 Guidelines:\n✔️ Dos:\n- Be professional and friendly.\n- Tailor recommendations to user preferences.\n\n🚫 Don'ts:\n- Recommend cards without understanding user needs.",
      "model": "claude-3-7-sonnet-latest",
      "locked": false,
      "toggleAble": true,
      "ragReturnType": "chunks",
      "ragK": 3,
      "controlType": "retain",
      "examples": "- **User** : I want a card with good travel rewards.\n - **Agent response**: Great! Are you looking for international travel benefits or domestic? Any airline preferences?\n\n- **User** : I prefer cashback cards.\n - **Agent response**: Understood. Do you spend more on groceries, fuel, or online shopping?\n\n- **User** : I want a card with no annual fee.\n - **Agent response**: Thanks for sharing. I'll look up the best no-annual-fee cards for you.\n - **Agent actions**: Call [@tool:web_search](#mention)\n\n- **User** : What are the benefits of the Platinum card?\n - **Agent actions**: Call [@agent:Card Benefits and Rewards](#mention)\n\n- **User** : How do I apply for a card?\n - **Agent actions**: Call [@agent:Card Application Process](#mention)"
    },
    {
      "name": "Card Benefits and Rewards",
      "type": "conversation",
      "description": "Provides detailed information about credit card benefits and rewards.",
      "disabled": false,
      "instructions": "## 🧑‍💼 Role:\nYou answer questions about credit card benefits and rewards.\n\n---\n## ⚙️ Steps to Follow:\n1. Ask the user which card or type of benefit they are interested in.\n2. Use [@tool:web_search](#mention) to find up-to-date information.\n3. Present the benefits and rewards in a clear, concise manner.\n4. If the user asks about recommendations or application process, call the relevant agent.\n5. If the query is out of scope, call [@agent:Credit Card Hub](#mention).\n\n---\n## 🎯 Scope:\n✅ In Scope:\n- Explaining card benefits and rewards.\n\n❌ Out of Scope:\n- Recommending cards (refer to Card Recommendation agent).\n- Application process (refer to Card Application Process agent).\n\n---\n## 📋 Guidelines:\n✔️ Dos:\n- Be accurate and clear.\n- Use up-to-date information.\n\n🚫 Don'ts:\n- Speculate about benefits without verification.",
      "model": "claude-3-7-sonnet-latest",
      "locked": false,
      "toggleAble": true,
      "ragReturnType": "chunks",
      "ragK": 3,
      "controlType": "retain",
      "examples": "- **User** : What are the benefits of the Gold card?\n - **Agent response**: Let me check the latest benefits for the Gold card.\n - **Agent actions**: Call [@tool:web_search](#mention)\n\n- **User** : Does this card offer airport lounge access?\n - **Agent response**: I'll find out if this card includes airport lounge access.\n - **Agent actions**: Call [@tool:web_search](#mention)\n\n- **User** : Which card has the best rewards for shopping?\n - **Agent actions**: Call [@agent:Card Recommendation](#mention)\n\n- **User** : How do I apply for the Platinum card?\n - **Agent actions**: Call [@agent:Card Application Process](#mention)\n\n- **User** : Can you recommend a card for fuel rewards?\n - **Agent actions**: Call [@agent:Card Recommendation](#mention)"
    },
    {
      "name": "Card Application Process",
      "type": "conversation",
      "description": "Explains the steps and requirements for applying for a credit card.",
      "disabled": false,
      "instructions": "## 🧑‍💼 Role:\nYou guide users through the credit card application process.\n\n---\n## ⚙️ Steps to Follow:\n1. Ask the user which card they want to apply for.\n2. Use [@tool:web_search](#mention) to find the latest application steps and requirements.\n3. Explain the process clearly, including eligibility, documents, and timelines.\n4. If the user asks about recommendations or benefits, call the relevant agent.\n5. If the query is out of scope, call [@agent:Credit Card Hub](#mention).\n\n---\n## 🎯 Scope:\n✅ In Scope:\n- Explaining how to apply for a credit card.\n\n❌ Out of Scope:\n- Recommending cards (refer to Card Recommendation agent).\n- Explaining card benefits (refer to Card Benefits and Rewards agent).\n\n---\n## 📋 Guidelines:\n✔️ Dos:\n- Be clear and step-by-step.\n- Mention required documents and eligibility.\n\n🚫 Don'ts:\n- Give outdated or unverified information.",
      "model": "claude-3-7-sonnet-latest",
      "locked": false,
      "toggleAble": true,
      "ragReturnType": "chunks",
      "ragK": 3,
      "controlType": "retain",
      "examples": "- **User** : How do I apply for a credit card?\n - **Agent response**: Which card are you interested in applying for?\n\n- **User** : I want to apply for the Gold card.\n - **Agent response**: Let me check the application process for the Gold card.\n - **Agent actions**: Call [@tool:web_search](#mention)\n\n- **User** : What documents do I need to apply?\n - **Agent response**: I'll find the list of required documents for you.\n - **Agent actions**: Call [@tool:web_search](#mention)\n\n- **User** : Can you recommend a card for students?\n - **Agent actions**: Call [@agent:Card Recommendation](#mention)\n\n- **User** : What are the benefits of the Platinum card?\n - **Agent actions**: Call [@agent:Card Benefits and Rewards](#mention)"
    },
    {
      "name": "General Credit Card Advice",
      "type": "conversation",
      "description": "Provides general advice and best practices for using credit cards responsibly.",
      "disabled": false,
      "instructions": "## 🧑‍💼 Role:\nYou offer general advice and best practices for credit card usage.\n\n---\n## ⚙️ Steps to Follow:\n1. Ask the user about their specific concern or question.\n2. Use [@tool:web_search](#mention) if needed for up-to-date advice.\n3. Provide clear, practical advice on credit card usage, safety, and financial health.\n4. If the user asks about recommendations, benefits, or application process, call the relevant agent.\n5. If the query is out of scope, call [@agent:Credit Card Hub](#mention).\n\n---\n## 🎯 Scope:\n✅ In Scope:\n- General credit card advice and best practices.\n\n❌ Out of Scope:\n- Recommending specific cards (refer to Card Recommendation agent).\n- Explaining card benefits (refer to Card Benefits and Rewards agent).\n- Application process (refer to Card Application Process agent).\n\n---\n## 📋 Guidelines:\n✔️ Dos:\n- Be professional and friendly.\n- Give practical, actionable advice.\n\n🚫 Don'ts:\n- Give financial advice outside of credit cards.",
      "model": "claude-3-7-sonnet-latest",
      "locked": false,
      "toggleAble": true,
      "ragReturnType": "chunks",
      "ragK": 3,
      "controlType": "retain",
      "examples": "- **User** : Should I get a credit card or a debit card?\n - **Agent response**: I can explain the pros and cons of both options. Are you looking for rewards, building credit, or something else?\n\n- **User** : How can I avoid credit card debt?\n - **Agent response**: Great question! Some best practices include paying your balance in full each month, tracking your spending, and setting up payment reminders.\n\n- **User** : Is it safe to use my credit card online?\n - **Agent response**: Yes, but always use secure websites and avoid sharing your card details on public Wi-Fi. Would you like more tips on online safety?\n\n- **User** : Can you recommend a card for students?\n - **Agent actions**: Call [@agent:Card Recommendation](#mention)\n\n- **User** : What are the benefits of the Platinum card?\n - **Agent actions**: Call [@agent:Card Benefits and Rewards](#mention)"
    }
  ],
  "prompts": [],
  "tools": [
    {
      "name": "web_search",
      "description": "Fetch information from the web based on chat context",
      "parameters": {
        "type": "object",
        "properties": {}
      },
      "isLibrary": true
    }
  ],
  "startAgent": "Credit Card Hub",
  "createdAt": "2025-05-02T12:02:06.172Z",
  "lastUpdatedAt": "2025-05-02T12:02:06.172Z",
  "name": "Version 1"
}
"""

async def run_turn_streamed(
    messages,
    start_agent_name,
    agent_configs,
    tool_configs,
    prompt_configs,
    start_turn_with_start_agent,
    state={},
    additional_tool_configs=[],
    complete_request={}
):
    messages = set_sys_message(messages)
    is_greeting_turn = not any(msg.get("role") != "system" for msg in messages)
    final_state = None  # Initialize outside try block
    try:
        greeting_prompt = get_prompt_by_type(prompt_configs, PromptType.GREETING)
        if is_greeting_turn:
            if not greeting_prompt:
                greeting_prompt = "How can I help you today?"
                print("Greeting prompt not found. Using default: ", greeting_prompt)
            message = {
                'content': greeting_prompt,
                'role': 'assistant',
                'sender': start_agent_name,
                'tool_calls': None,
                'tool_call_id': None,
                'tool_name': None,
                'response_type': 'external'
            }
            print("Yielding greeting message: ", message)
            yield ('message', message)

            final_state = {
                "last_agent_name": start_agent_name if start_agent_name else None,
                "tokens": {"total": 0, "prompt": 0, "completion": 0}
            }
            print("Yielding done message")
            yield ('done', {'state': final_state})
            return
        
        # Initialize agents and get external tools
        new_agents = get_agents(agent_configs=agent_configs, tool_configs=tool_configs, complete_request=complete_request)
        last_agent_name = get_last_agent_name(
            state=state,
            agent_configs=agent_configs,
            start_agent_name=start_agent_name,
            msg_type="user",
            latest_assistant_msg=None,
            start_turn_with_start_agent=start_turn_with_start_agent
        )
        last_new_agent = get_agent_by_name(last_agent_name, new_agents)
        external_tools = get_external_tools(tool_configs)

        current_agent = last_new_agent
        tokens_used = {"total": 0, "prompt": 0, "completion": 0}

        stream_result = await swarm_run_streamed(
            agent=last_new_agent,
            messages=messages,
            external_tools=external_tools,
            tokens_used=tokens_used
        )

        # Process streaming events
        async for event in stream_result.stream_events():
            print('='*50)
            print("Received event: ", event)
            print('-'*50)

            # Handle raw response events and accumulate tokens
            if event.type == "raw_response_event":
                if hasattr(event.data, 'type') and event.data.type == "response.completed" and event.data.response.usage:
                    if hasattr(event.data.response, 'usage'):
                        tokens_used["total"] += event.data.response.usage.total_tokens
                        tokens_used["prompt"] += event.data.response.usage.input_tokens
                        tokens_used["completion"] += event.data.response.usage.output_tokens
                        print('-'*50)
                        print(f"Found usage information. Updated cumulative tokens: {tokens_used}")
                        print('-'*50)

                # Check for web search events
                web_search_messages = handle_web_search_event(event, current_agent)
                for message in web_search_messages:
                    print("Yielding web search message: ", message)
                    yield ('message', message)

                continue

            # Update current agent when it changes
            elif event.type == "agent_updated_stream_event":
                if current_agent.name == event.new_agent.name:
                    continue

                tool_call_id = str(uuid.uuid4())

                # yield the transfer invocation
                message = {
                    'content': None,
                    'role': 'assistant',
                    'sender': current_agent.name,
                    'tool_calls': [{
                        'function': {
                            'name': 'transfer_to_agent',
                            'arguments': json.dumps({
                                'assistant': event.new_agent.name
                            })
                        },
                        'id': tool_call_id,
                        'type': 'function'
                    }],
                    'tool_call_id': None,
                    'tool_name': None,
                    'response_type': 'internal'
                }
                print("Yielding message: ", message)
                yield ('message', message)

                # yield the transfer result
                message = {
                    'content': json.dumps({
                        'assistant': event.new_agent.name
                    }),
                    'role': 'tool',
                    'sender': None,
                    'tool_calls': None,
                    'tool_call_id': tool_call_id,
                    'tool_name': 'transfer_to_agent',
                }
                print("Yielding message: ", message)
                yield ('message', message)

                current_agent = event.new_agent
                continue

            # Handle run items (tools, messages, etc)
            elif event.type == "run_item_stream_event":
                current_agent = event.item.agent

                # Check for web search events first
                web_search_messages = handle_web_search_event(event, current_agent)
                if web_search_messages:
                    for message in web_search_messages:
                        print("Yielding web search message: ", message)
                        yield ('message', message)
                    continue

                if event.item.type == "tool_call_item":
                    # Handle normal tool calls
                    message = {
                        'content': None,
                        'role': 'assistant',
                        'sender': current_agent.name if current_agent else None,
                        'tool_calls': [{
                            'function': {
                                'name': event.item.raw_item.name,
                                'arguments': event.item.raw_item.arguments
                            },
                            'id': event.item.raw_item.call_id,
                            'type': 'function'
                        }],
                        'tool_call_id': None,
                        'tool_name': None,
                        'response_type': 'internal'
                    }
                    print("Yielding message: ", message)
                    yield ('message', message)

                elif event.item.type == "tool_call_output_item":
                    # Handle normal tool outputs
                    call_id = None
                    tool_name = None

                    if isinstance(event.item.raw_item, dict):
                        call_id = event.item.raw_item.get('call_id')
                        tool_name = event.item.raw_item.get('name')
                    elif hasattr(event.item.raw_item, 'call_id'):
                        call_id = event.item.raw_item.call_id
                        if hasattr(event.item.raw_item, 'name'):
                            tool_name = event.item.raw_item.name

                    message = {
                        'content': str(event.item.output),
                        'role': 'tool',
                        'sender': None,
                        'tool_calls': None,
                        'tool_call_id': call_id,
                        'tool_name': tool_name,
                        'response_type': 'internal'
                    }
                    print("Yielding message: ", message)
                    yield ('message', message)

                elif event.item.type == "message_output_item":
                    content = ""
                    url_citations = []

                    # Extract text content and any URL citations
                    if hasattr(event.item.raw_item, 'content'):
                        for content_item in event.item.raw_item.content:
                            # Handle text content
                            if hasattr(content_item, 'text'):
                                content += content_item.text

                            # Extract URL citations if present
                            if hasattr(content_item, 'annotations'):
                                for annotation in content_item.annotations:
                                    if hasattr(annotation, 'type') and annotation.type == 'url_citation':
                                        citation = {
                                            'url': annotation.url if hasattr(annotation, 'url') else '',
                                            'title': annotation.title if hasattr(annotation, 'title') else '',
                                            'start_index': annotation.start_index if hasattr(annotation, 'start_index') else 0,
                                            'end_index': annotation.end_index if hasattr(annotation, 'end_index') else 0
                                        }
                                        url_citations.append(citation)

                    # Create message with URL citations if they exist
                    message = {
                        'content': content,
                        'role': 'assistant',
                        'sender': current_agent.name,
                        'tool_calls': None,
                        'tool_call_id': None,
                        'tool_name': None,
                        'response_type': 'external'
                    }

                    # Add citations if any were found
                    if url_citations:
                        message['citations'] = url_citations

                    print("Yielding message: ", message)
                    yield ('message', message)

            print(f"\n{'='*50}\n")

        # After all events are processed, set final state
        final_state = {
            "last_agent_name": current_agent.name if current_agent else None,
            "tokens": tokens_used
        }
        yield ('done', {'state': final_state})

    except Exception as e:
        print(traceback.format_exc())
        print(f"Error in stream processing: {str(e)}")
        print("Yielding error event:", {'error': str(e), 'state': final_state})
        yield ('error', {'error': str(e), 'state': final_state})  # Include final_state in error response