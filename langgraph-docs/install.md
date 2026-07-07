
# LangGraph overview

Gain control with LangGraph to design agents that reliably handle complex tasks

Show how LangChain products fit together

- Deep Agents is an agent harness: planning, subagents, filesystem tools, and context management on top of LangGraph.
- LangChain is the agent framework: abstractions and integrations for models, tools, and agent loops.
- LangGraph is the orchestration runtime: durable execution, streaming, human-in-the-loop, and persistence.
- LangSmith is the platform for tracing, evaluation, prompts, and deployment across frameworks.
- LangSmith Engine detects issues in your LangGraph agent traces and proposes fixes. You can open a pull request with the proposed fix directly from the Engine tab.
- LangSmith Fleet is the no-code agent builder for templates, integrations, and routine automation.


## ​ Install


```typescript
npm install @langchain/langgraph @langchain/core

```


```typescript
import { StateSchema, MessagesValue, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";

const State = new StateSchema({
  messages: MessagesValue,
});

const mockLlm: GraphNode<typeof State> = (state) => {
  return { messages: [{ role: "ai", content: "hello world" }] };
};

const graph = new StateGraph(State)
  .addNode("mock_llm", mockLlm)
  .addEdge(START, "mock_llm")
  .addEdge("mock_llm", END)
  .compile();

await graph.invoke({ messages: [{ role: "user", content: "hi!" }] });

```

`LANGSMITH_TRACING=true`
## ​Core benefits

- Persistence: Build agents that persist through failures and can run for extended periods, resuming from where they left off.
- Human-in-the-loop: Incorporate human oversight by inspecting and modifying agent state at any point.
- Comprehensive memory: Create stateful agents with both short-term working memory for ongoing reasoning and long-term memory across sessions.
- Debugging with LangSmith: Gain deep visibility into complex agent behavior with visualization tools that trace execution paths, capture state transitions, and provide detailed runtime metrics.
- Production-ready deployment: Deploy sophisticated agent systems confidently with scalable infrastructure designed to handle the unique challenges of stateful, long-running workflows.


## ​LangGraph ecosystem


## LangSmith Observability


## LangSmith Deployment


## LangChain


## ​Acknowledgements


---

