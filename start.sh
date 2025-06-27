docker run -d \
  --privileged \
  --network=host \
  --name mcp-runner-container \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc:/etc \
  -v /var/mcp-runner:/var/mcp-runner \
  tangierai/mcp-runner:latest
