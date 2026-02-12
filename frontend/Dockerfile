# Usa o Node leve
FROM node:20-alpine

# Define a pasta de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de configuração
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o resto do código
COPY . .

# Expõe a porta do Vite
EXPOSE 5173

# Comando para rodar liberando o acesso externo
CMD ["npm", "run", "dev", "--", "--host"]