FROM nginx:alpine

# Hapus konten default
RUN rm -rf /usr/share/nginx/html/*

# Salin hasil build Angular (dari /browser, bukan root talkvera)
COPY ./dist/chat-widget/browser/ /usr/share/nginx/html

# Salin nginx.conf ke config default
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
