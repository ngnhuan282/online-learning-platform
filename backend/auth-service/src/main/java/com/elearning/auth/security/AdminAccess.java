package com.elearning.auth.security;

import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.UserRepository;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component("adminAccess")
public class AdminAccess {

    private final UserRepository users;

    public AdminAccess(UserRepository users) {
        this.users = users;
    }

    // Auth administration checks the current database state, not stale JWT role claims.
    @Transactional(readOnly = true)
    public boolean allowed(Authentication authentication, String permission) {
        if (authentication == null) return false;
        try {
            return users
                .findById(Long.parseLong(authentication.getName()))
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .map(user -> permissions(user).contains(permission))
                .orElse(false);
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    public static Set<String> permissions(User user) {
        if (
            user
                .getRoles()
                .stream()
                .anyMatch(role -> "ADMIN".equals(role.getName()))
        ) {
            return AdminPermission.allCodes();
        }
        return user
            .getRoles()
            .stream()
            .flatMap(role -> role.getPermissions().stream())
            .collect(Collectors.toSet());
    }
}
