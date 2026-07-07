
# Thinking in LangGraph

Learn how to think about building agents with LangGraph


## ​Start with the process you want to automate


```
The agent should:

- Read incoming customer emails
- Classify them by urgency and topic
- Search relevant documentation to answer questions
- Draft appropriate responses
- Escalate complex issues to human agents
- Schedule follow-ups when needed

Example scenarios to handle:

1. Simple product question: "How do I reset my password?"
2. Bug report: "The export feature crashes when I select PDF format"
3. Urgent billing issue: "I was charged twice for my subscription!"
4. Feature request: "Can you add dark mode to the mobile app?"
5. Complex technical issue: "Our API integration fails intermittently with 504 errors"

```


## ​Step 1: Map out your workflow as discrete steps

- Read Email: Extract and parse the email content
- Classify Intent: Use an LLM to categorize urgency and topic, then route to appropriate action
- Doc Search: Query your knowledge base for relevant information
- Bug Track: Create or update issue in tracking system
- Draft Reply: Generate an appropriate response
- Human Review: Escalate to human agent for approval or handling
- Send Reply: Dispatch the email response


## ​Step 2: Identify what each step needs to do


## LLM steps


## Data steps


## Action steps


## User input steps


### ​LLM steps

Classify intent

- Static context (prompt): Classification categories, urgency definitions, response format
- Dynamic context (from state): Email content, sender information
- Desired outcome: Structured classification that determines routing

Draft reply

- Static context (prompt): Tone guidelines, company policies, response templates
- Dynamic context (from state): Classification results, search results, customer history
- Desired outcome: Professional email response ready for review


### ​Data steps

Document search

- Parameters: Query built from intent and topic
- Retry strategy: Yes, with exponential backoff for transient failures
- Caching: Could cache common queries to reduce API calls

Customer history lookup

- Parameters: Customer email or ID from state
- Retry strategy: Yes, but with fallback to basic info if unavailable
- Caching: Yes, with time-to-live to balance freshness and performance


### ​Action steps

Send reply

- When to execute node: After approval (human or automated)
- Retry strategy: Yes, with exponential backoff for network issues
- Should not cache: Each send is a unique action

Bug track

- When to execute node: Always when intent is “bug”
- Retry strategy: Yes, critical to not lose bug reports
- Returns: Ticket ID to include in response


### ​User input steps

Human review node

- Context for decision: Original email, draft response, urgency, classification
- Expected input format: Approval boolean plus optional edited response
- When triggered: High urgency, complex issues, or quality concerns


## ​Step 3: Design your state


### ​What belongs in state?


## Include in state


## Don't store

- The original email and sender info (can’t reconstruct these later)
- Classification results (needed by multiple later/downstream nodes)
- Search results and customer data (expensive to re-fetch)
- The draft response (needs to persist through review)
- Execution metadata (for debugging and recovery)


### ​Keep state raw, format prompts on-demand

- Different nodes can format the same data differently for their needs
- You can change prompt templates without modifying your state schema
- Debugging is clearer—you see exactly what data each node received
- Your agent can evolve without breaking existing state


```
import { StateSchema } from "@langchain/langgraph";
import * as z from "zod";

// Define the structure for email classification
const EmailClassificationSchema = z.object({
  intent: z.enum(["question", "bug", "billing", "feature", "complex"]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  topic: z.string(),
  summary: z.string(),
});

const EmailAgentState = new StateSchema({
  // Raw email data
  emailContent: z.string(),
  senderEmail: z.string(),
  emailId: z.string(),

  // Classification result
  classification: EmailClassificationSchema.optional(),

  // Raw search/API results
  searchResults: z.array(z.string()).optional(),  // List of raw document chunks
  customerHistory: z.record(z.string(), z.any()).optional(),  // Raw customer data from CRM

  // Generated content
  responseText: z.string().optional(),
});

type EmailClassificationType = z.infer<typeof EmailClassificationSchema>;

```


## ​Step 4: Build your nodes


### ​Handle errors appropriately

- Transient errors
- LLM-recoverable
- User-fixable
- Unexpected
- Saga / compensation


```
import type { RetryPolicy } from "@langchain/langgraph";

workflow.addNode(
  "searchDocumentation",
  searchDocumentation,
  {
    retryPolicy: { maxAttempts: 3, initialInterval: 1.0 },
  },
);

```


```
import { Command, GraphNode } from "@langchain/langgraph";

const executeTool: GraphNode<typeof State> = async (state, config) => {
  try {
    const result = await runTool(state.toolCall);
    return new Command({
      update: { toolResult: result },
      goto: "agent",
    });
  } catch (error) {
    // Let the LLM see what went wrong and try again
    return new Command({
      update: { toolResult: `Tool error: ${error}` },
      goto: "agent"
    });
  }
}

```


```
import { Command, GraphNode, interrupt } from "@langchain/langgraph";

const lookupCustomerHistory: GraphNode<typeof State> = async (state, config) => {
  if (!state.customerId) {
    const userInput = interrupt({
      message: "Customer ID needed",
      request: "Please provide the customer's account ID to look up their subscription history",
    });
    return new Command({
      update: { customerId: userInput.customerId },
      goto: "lookupCustomerHistory",
    });
  }
  // Now proceed with the lookup
  const customerData = await fetchCustomerHistory(state.customerId);
  return new Command({
    update: { customerHistory: customerData },
    goto: "draftResponse",
  });
}

```


```
import { Command, GraphNode } from "@langchain/langgraph";

const sendReply: GraphNode<typeof EmailAgentState> = async (state, config) => {
  try {
    await emailService.send(state.responseText);
  } catch (error) {
    throw error;  // Surface unexpected errors
  }
}

```


### ​Implementing our email agent nodes

Read and classify nodes


```
import { StateGraph, START, END, GraphNode, Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";

const llm = new ChatAnthropic({ model: "claude-sonnet-4-6" });

const readEmail: GraphNode<typeof EmailAgentState> = async (state, config) => {
  // Extract and parse email content
  // In production, this would connect to your email service
  console.log(`Processing email: ${state.emailContent}`);
  return {};
}

const classifyIntent: GraphNode<typeof EmailAgentState> = async (state, config) => {
  // Use LLM to classify email intent and urgency, then route accordingly

  // Create structured LLM that returns EmailClassification object
  const structuredLlm = llm.withStructuredOutput(EmailClassificationSchema);

  // Format the prompt on-demand, not stored in state
  const classificationPrompt = `
  Analyze this customer email and classify it:

  Email: ${state.emailContent}
  From: ${state.senderEmail}

  Provide classification including intent, urgency, topic, and summary.
  `;

  // Get structured response directly as object
  const classification = await structuredLlm.invoke(classificationPrompt);

  // Determine next node based on classification
  let nextNode: "searchDocumentation" | "humanReview" | "draftResponse" | "bugTracking";

  if (classification.intent === "billing" || classification.urgency === "critical") {
    nextNode = "humanReview";
  } else if (classification.intent === "question" || classification.intent === "feature") {
    nextNode = "searchDocumentation";
  } else if (classification.intent === "bug") {
    nextNode = "bugTracking";
  } else {
    nextNode = "draftResponse";
  }

  // Store classification as a single object in state
  return new Command({
    update: { classification },
    goto: nextNode,
  });
}

```

Search and tracking nodes


```
import { Command, GraphNode } from "@langchain/langgraph";

const searchDocumentation: GraphNode<typeof EmailAgentState> = async (state, config) => {
  // Search knowledge base for relevant information

  // Build search query from classification
  const classification = state.classification!;
  const query = `${classification.intent} ${classification.topic}`;

  let searchResults: string[];

  try {
    // Implement your search logic here
    // Store raw search results, not formatted text
    searchResults = [
      "Reset password via Settings > Security > Change Password",
      "Password must be at least 12 characters",
      "Include uppercase, lowercase, numbers, and symbols",
    ];
  } catch (error) {
    // For recoverable search errors, store error and continue
    searchResults = [`Search temporarily unavailable: ${error}`];
  }

  return new Command({
    update: { searchResults },  // Store raw results or error
    goto: "draftResponse",
  });
}

const bugTracking: GraphNode<typeof EmailAgentState> = async (state, config) => {
  // Create or update bug tracking ticket

  // Create ticket in your bug tracking system
  const ticketId = "BUG-12345";  // Would be created via API

  return new Command({
    update: { searchResults: [`Bug ticket ${ticketId} created`] },
    goto: "draftResponse",
  });
}

```

Response nodes


```
import { Command, interrupt } from "@langchain/langgraph";

const draftResponse: GraphNode<typeof EmailAgentState> = async (state, config) => {
  // Generate response using context and route based on quality

  const classification = state.classification!;

  // Format context from raw state data on-demand
  const contextSections: string[] = [];

  if (state.searchResults) {
    // Format search results for the prompt
    const formattedDocs = state.searchResults.map(doc => `- ${doc}`).join("\n");
    contextSections.push(`Relevant documentation:\n${formattedDocs}`);
  }

  if (state.customerHistory) {
    // Format customer data for the prompt
    contextSections.push(`Customer tier: ${state.customerHistory.tier ?? "standard"}`);
  }

  // Build the prompt with formatted context
  const draftPrompt = `
  Draft a response to this customer email:
  ${state.emailContent}

  Email intent: ${classification.intent}
  Urgency level: ${classification.urgency}

  ${contextSections.join("\n\n")}

  Guidelines:
  - Be professional and helpful
  - Address their specific concern
  - Use the provided documentation when relevant
  `;

  const response = await llm.invoke([new HumanMessage(draftPrompt)]);

  // Determine if human review needed based on urgency and intent
  const needsReview = (
    classification.urgency === "high" ||
    classification.urgency === "critical" ||
    classification.intent === "complex"
  );

  // Route to appropriate next node
  const nextNode = needsReview ? "humanReview" : "sendReply";

  return new Command({
    update: { responseText: response.content.toString() },  // Store only the raw response
    goto: nextNode,
  });
}

const humanReview: GraphNode<typeof EmailAgentState> = async (state, config) => {
  // Pause for human review using interrupt and route based on decision
  const classification = state.classification!;

  // interrupt() must come first - any code before it will re-run on resume
  const humanDecision = interrupt({
    emailId: state.emailId,
    originalEmail: state.emailContent,
    draftResponse: state.responseText,
    urgency: classification.urgency,
    intent: classification.intent,
    action: "Please review and approve/edit this response",
  });

  // Now process the human's decision
  if (humanDecision.approved) {
    return new Command({
      update: { responseText: humanDecision.editedResponse || state.responseText },
      goto: "sendReply",
    });
  } else {
    // Rejection means human will handle directly
    return new Command({ update: {}, goto: END });
  }
}

const sendReply: GraphNode<typeof EmailAgentState> = async (state, config) => {
  // Send the email response
  // Integrate with email service
  console.log(`Sending reply: ${state.responseText!.substring(0, 100)}...`);
  return {};
}

```


## ​Step 5: Wire it together

Graph compilation code


```
import { MemorySaver, RetryPolicy } from "@langchain/langgraph";

// Create the graph
const workflow = new StateGraph(EmailAgentState)
  // Add nodes with appropriate error handling
  .addNode("readEmail", readEmail)
  .addNode("classifyIntent", classifyIntent)
  // Add retry policy for nodes that might have transient failures
  .addNode(
    "searchDocumentation",
    searchDocumentation,
    { retryPolicy: { maxAttempts: 3 } },
  )
  .addNode("bugTracking", bugTracking)
  .addNode("draftResponse", draftResponse)
  .addNode("humanReview", humanReview)
  .addNode("sendReply", sendReply)
  // Add only the essential edges
  .addEdge(START, "readEmail")
  .addEdge("readEmail", "classifyIntent")
  .addEdge("sendReply", END);

// Compile with checkpointer for persistence
const memory = new MemorySaver();
const app = workflow.compile({ checkpointer: memory });

```


### ​Try out your agent

Testing the agent


```
// Test with an urgent billing issue
const initialState: EmailAgentStateType = {
  emailContent: "I was charged twice for my subscription! This is urgent!",
  senderEmail: "customer@example.com",
  emailId: "email_123"
};

// Run with a thread_id for persistence
const config = { configurable: { thread_id: "customer_123" } };
const result = await app.invoke(initialState, config);
// The graph will pause at human_review
console.log(`Draft ready for review: ${result.responseText?.substring(0, 100)}...`);

```


```
import { Command } from "@langchain/langgraph";

// When ready, provide human input to resume
const humanResponse = new Command({
  resume: {
    approved: true,
    editedResponse: "We sincerely apologize for the double charge. I've initiated an immediate refund...",
  }
});

// Resume execution
const finalResult = await app.invoke(humanResponse, config);
console.log("Email sent successfully!");

```


## ​Summary and next steps


### ​Key Insights


## Break into discrete steps


## State is shared memory


## Nodes are functions


## Errors are part of the flow


## Human input is first-class


## Graph structure emerges naturally


### ​Advanced considerations

Node granularity trade-offs

- Isolation of external services: Doc Search and Bug Track are separate nodes because they call external APIs. If the search service is slow or fails, we want to isolate that from the LLM calls. We can add retry policies to these specific nodes without affecting others.
- Intermediate visibility: Having Classify Intent as its own node lets us inspect what the LLM decided before taking action. This is valuable for debugging and monitoring—you can see exactly when and why the agent routes to human review.
- Different failure modes: LLM calls, database lookups, and email sending have different retry strategies. Separate nodes let you configure these independently.
- Reusability and testing: Smaller nodes are easier to test in isolation and reuse in other workflows.


### ​Where to go from here


## Human-in-the-loop patterns


## Subgraphs


## Streaming


## Observability


## Tool Integration


## Retry Logic


---

