FROM nginx:alpine

RUN apk add --no-cache curl

RUN mkdir -p /usr/share/nginx/html/admin

COPY html /usr/share/nginx/html
COPY conf/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
