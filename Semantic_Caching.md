# Semantic Caching

When implementing processes with LLMs the cost model is very simple, inputs & outpus = tokens and tokens = $$$. So when you are building applications to scale and have a process such as a Help Chat Bot that has frequently asked questions, rather than using an LLM to answer everytime, you are able to semantically cache on intent of query as opposed to string matching. This means in essence that we are able to answer in the AI Help Chat Bot without actually going to an LLM and incurring a cost for the most frequently asked questions.

Not only does this drastically reduce cost at scale, but given the non-deterministic state of using an LLM, it gives a set response to all consumers of the process, in this case a Help Chat Bot.

A much more detailed article on Semantic Caching can be found here: https://techcommunity.microsoft.com/blog/azurearchitectureblog/optimize-azure-openai-applications-with-semantic-caching/4106867