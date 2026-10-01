package com.elearning.auth.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import java.util.Map;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI authOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("LearnSphere Auth, User and RBAC API")
                .version("v1")
                .description("All responses use the ApiResponse or ApiError envelope. " +
                    "Access tokens are sent as Bearer credentials; refresh tokens use an HttpOnly cookie."))
            .servers(List.of(new Server().url("/").description("API Gateway")))
            .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
            .schemaRequirement("bearerAuth", new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT"));
    }

    @Bean
    OpenApiCustomizer authContract() {
        Map<String, String> errors = Map.of(
            "400", "VALIDATION_ERROR or MALFORMED_REQUEST",
            "401", "UNAUTHORIZED, INVALID_CREDENTIALS or refresh token error",
            "403", "FORBIDDEN, ACCOUNT_LOCKED or ACCOUNT_DISABLED",
            "404", "NOT_FOUND or USER_NOT_FOUND",
            "409", "CONFLICT or EMAIL_ALREADY_EXISTS"
        );
        return openApi -> {
            var errorSchema = new ObjectSchema()
                .addProperty("success", new Schema<Boolean>().type("boolean").example(false))
                .addProperty("code", new Schema<String>().type("string"))
                .addProperty("message", new Schema<String>().type("string"))
                .addProperty("errors", new ObjectSchema().nullable(true))
                .addProperty("timestamp", new Schema<String>().type("string").format("date-time"))
                .addProperty("path", new Schema<String>().type("string"));
            openApi.getComponents().addSchemas("ApiError", errorSchema);
            openApi.getPaths().forEach((path, item) -> item.readOperations().forEach(operation -> {
                if (path.startsWith("/api/v1/auth/")) operation.setSecurity(List.of());
                errors.forEach((status, description) -> operation.getResponses().putIfAbsent(
                    status,
                    new ApiResponse()
                        .description(description)
                        .content(new Content().addMediaType(
                            "application/json",
                            new io.swagger.v3.oas.models.media.MediaType()
                                .schema(new Schema<>().$ref("#/components/schemas/ApiError"))
                        ))
                ));
            }));
        };
    }
}
