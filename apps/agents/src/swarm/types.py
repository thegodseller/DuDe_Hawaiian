from __future__ import annotations

from openai.types.chat import ChatCompletionMessage
from openai.types.chat.chat_completion_message_tool_call import (
    ChatCompletionMessageToolCall,
    Function,
)
from typing import List, Callable, Union, Optional, Dict

# Third-party imports
from pydantic import BaseModel

AgentFunction = Callable[[], Union[str, "Agent", dict]]

class Agent(BaseModel):
    name: str = "Agent"
    model: str = "gpt-4o"
    type: str = ""
    instructions: Union[str, Callable[[], str]] = "You are a helpful agent.",
    description: str = "This is a helpful agent."
    candidate_parent_functions: Dict[str, AgentFunction] = {}
    parent_function: AgentFunction = None
    child_functions: Dict[str, AgentFunction] = {}
    internal_tools: List[Dict] = []
    external_tools: List[Dict] = []
    tool_choice: str = None
    parallel_tool_calls: bool = True
    respond_to_user: bool = True
    history: List[Dict] = []
    children_names: List[str] = []
    children: Dict[str, "Agent"] = {}
    most_recent_parent: Optional["Agent"] = None
    parent: "Agent" = None

class Response(BaseModel):
    messages: List = []
    agent: Optional[Agent] = None
    context_variables: dict = {}
    error_msg: Optional[str] = ""
    tokens_used: dict = {}

class Result(BaseModel):
    """
    Encapsulates the possible return values for an agent function.

    Attributes:
        value (str): The result value as a string.
        agent (Agent): The agent instance, if applicable.
        context_variables (dict): A dictionary of context variables.
    """

    value: str = ""
    agent: Optional[Agent] = None
    context_variables: dict = {}