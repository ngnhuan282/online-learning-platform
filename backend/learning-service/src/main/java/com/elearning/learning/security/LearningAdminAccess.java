package com.elearning.learning.security;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("learningAdmin")
public class LearningAdminAccess {

    public boolean allowed(Authentication auth, String permission) {
        if (auth == null || !auth.isAuthenticated()) return false;
        var authorities = auth
            .getAuthorities()
            .stream()
            .map(a -> a.getAuthority())
            .toList();
        return (
            authorities.contains("ROLE_ADMIN") ||
            (authorities.stream().anyMatch(a -> a.startsWith("ROLE_") && !a.equals("ROLE_USER")) &&
                authorities.contains("ADMIN_ACCESS") &&
                authorities.contains(permission))
        );
    }
}
