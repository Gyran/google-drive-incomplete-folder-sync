FROM node:16-alpine
WORKDIR /app

ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

COPY README.md package.json package-lock.json index.js ./
COPY ./src ./src/

ENV NODE_ENV production
RUN npm install --only=production

VOLUME ["/data", "/config"]

ENTRYPOINT ["node", "index.js"]
