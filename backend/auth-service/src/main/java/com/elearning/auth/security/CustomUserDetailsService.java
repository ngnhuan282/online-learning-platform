package com.elearning.auth.security;

import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.UserRepository;
import java.util.Locale;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public CustomUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        if (email == null) throw new UsernameNotFoundException("Invalid credentials");
        var user = users
            .findByEmailIgnoreCase(email.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
        return User.withUsername(user.getEmail())
            .password(user.getPasswordHash())
            .roles(
                user
                    .getRoles()
                    .stream()
                    .map(role -> role.getName().name())
                    .toArray(String[]::new)
            )
            .disabled(user.getStatus() == UserStatus.DISABLED)
            .accountLocked(user.getStatus() == UserStatus.LOCKED)
            .build();
    }
}
