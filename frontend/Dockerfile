FROM ghcr.io/cirruslabs/flutter:3.22.2 AS build
WORKDIR /app
COPY pubspec.yaml ./
RUN flutter pub get
COPY . .
ARG API_BASE_URL
RUN flutter build web --release --dart-define=API_BASE_URL=${API_BASE_URL}

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/web /usr/share/nginx/html
EXPOSE 80
