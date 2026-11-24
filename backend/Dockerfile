FROM golang:1.27.4-alpine3.24@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go schema.sql ./
RUN CGO_ENABLED=0 go build -trimpath -o /marketplace .

FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
RUN mkdir /data && chown 10001:10001 /data
COPY --from=build /marketplace /usr/local/bin/marketplace
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/marketplace"]
