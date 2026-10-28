# Build from the repository root: docker build -f backend/api/Dockerfile -t luton-homes-api .
# The API reads the property list from site/data/homes.json, so both folders are copied.
FROM node:22-alpine
WORKDIR /app
COPY site/data ./site/data
COPY backend/api ./backend/api
USER node
ENV PORT=8787 DATA_FILE=/data/store.json
VOLUME /data
EXPOSE 8787
CMD ["node", "backend/api/src/server.js"]
