# syntax=docker/dockerfile:1.7

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace

COPY country-service-main/pom.xml ./
COPY country-service-main/checkstyle.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests dependency:go-offline

COPY country-service-main/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests package

FROM gcr.io/distroless/java17-debian12:nonroot
WORKDIR /app

COPY --from=build /workspace/target/*.jar /app/country-service.jar

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/country-service.jar"]
