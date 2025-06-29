#!/bin/bash

# Default to npm start if no arguments provided
if [ $# -eq 0 ]; then
    exec npm run start:prod
fi

# Handle different commands
case "$1" in
    "publish:sourcemap")
        exec npm run sentry:sourcemaps
        ;;

    "start")
        exec npm run start:prod
        ;;
    *)
        echo "Unknown command: $1"
        exit 1
        ;;
esac
