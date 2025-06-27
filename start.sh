docker run -d --privileged --network=host --name mcp-runner-container -v /var/run/docker.sock:/var/run/docker.sock -v /etc:/etc tangierai/mcp-runner:latest
