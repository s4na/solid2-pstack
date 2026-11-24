FROM golang:1.27.4-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go schema.sql ./
RUN CGO_ENABLED=0 go build -trimpath -o /marketplace .

FROM alpine:3.23
RUN mkdir /data && chown 10001:10001 /data
COPY --from=build /marketplace /usr/local/bin/marketplace
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/marketplace"]
