FROM node:20

WORKDIR /usr/src/app/aos8

COPY ./package.json .

RUN npm install

COPY . .

CMD [ "node", "server.js" ]