FROM node:20-alpine
WORKDIR /app
# OpenSSL na imagem: abre o .pfx para dizer senha, titular e validade antes da SEFAZ.
RUN apk add --no-cache openssl
COPY package.json server.js ./
COPY lib ./lib
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server.js"]
