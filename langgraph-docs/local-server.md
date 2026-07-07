
# Run a local server


## ​Prerequisites

- An API key for LangSmith - free to sign up


## ​1. Install the LangGraph CLI


```
npm install --save-dev @langchain/langgraph-cli

```


## ​2. Create a LangGraph app


```
npm create langgraph

```

Adding LangGraph to an existing project


```
npm create langgraph config

```


```
{
  "node_version": "24",
  "graphs": {
    "agent": "./src/agent.ts:agent",
    "searchAgent": "./src/search.ts:searchAgent"
  },
  "env": ".env"
}

```


## ​3. Install dependencies


```
cd path/to/your/app
npm install

```


## ​4. Create a .env file


```
LANGSMITH_API_KEY=lsv2...

```


## ​5. Launch Agent server


```
npx @langchain/langgraph-cli dev

```


```
INFO:langgraph_api.cli:

        Welcome to

╦  ┌─┐┌┐┌┌─┐╔═╗┬─┐┌─┐┌─┐┬ ┬
║  ├─┤││││ ┬║ ╦├┬┘├─┤├─┘├─┤
╩═╝┴ ┴┘└┘└─┘╚═╝┴└─┴ ┴┴  ┴ ┴

- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs

This in-memory server is designed for development and testing.
For production use, please use LangSmith Deployment.

```


## ​6. Test your application in Studio


```
>    - LangGraph Studio Web UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024

```


```
https://smith.langchain.com/studio/?baseUrl=http://myhost:3000

```

Safari compatibility


```
langgraph dev --tunnel

```


## ​7. Test the API

- Javascript SDK
- Rest API

1. Install the LangGraph JS SDK:
npm install @langchain/langgraph-sdk
2. Send a message to the assistant (threadless run):


```
import { Client } from "@langchain/langgraph-sdk";

// only set the apiUrl if you changed the default port when calling langgraph dev
const client = new Client({ apiUrl: "http://localhost:2024"});

const streamResponse = client.runs.stream(
  null, // Threadless run
  "agent", // Assistant ID
  {
    input: {
      "messages": [
        { "role": "user", "content": "What is LangGraph?"}
      ]
    },
    streamMode: "messages-tuple",
  }
);

for await (const chunk of streamResponse) {
  console.log(`Receiving new event of type: ${chunk.event}...`);
  console.log(JSON.stringify(chunk.data));
  console.log("\n\n");
}

```


```
curl -s --request POST \
    --url "http://localhost:2024/runs/stream" \
    --header 'Content-Type: application/json' \
    --data "{
        \"assistant_id\": \"agent\",
        \"input\": {
            \"messages\": [
                {
                    \"role\": \"human\",
                    \"content\": \"What is LangGraph?\"
                }
            ]
        },
        \"stream_mode\": \"messages-tuple\"
    }"

```


## ​Next steps

- Deployment quickstart: Deploy your LangGraph app using LangSmith.
- LangSmith: Learn about foundational LangSmith concepts.
- SDK Reference: Explore the SDK API Reference.


---

