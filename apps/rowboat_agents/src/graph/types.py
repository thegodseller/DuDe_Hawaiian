from enum import Enum
class AgentRole(Enum):
    ESCALATION = "escalation"
    POST_PROCESSING = "post_process"
    GUARDRAILS = "guardrails"

class VisibilityType(Enum):
    EXTERNAL = "external"
    INTERNAL = "internal"

class ControlType(Enum):
    RETAIN = "retain"
    PARENT_AGENT = "relinquish_to_parent"

class PromptType(Enum):
    STYLE = "style_prompt"
    GREETING = "greeting"

class ErrorType(Enum):
    FATAL = "fatal"
    ESCALATE = "escalate"