FROM maven:3.9-eclipse-temurin-21 AS build
ARG SERVICE
WORKDIR /build
COPY backend/${SERVICE}/pom.xml ./pom.xml
COPY backend/${SERVICE}/src ./src
RUN mvn -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN groupadd --system app && useradd --system --gid app app && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --from=build /build/target/*-SNAPSHOT.jar /app/app.jar
USER app
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
