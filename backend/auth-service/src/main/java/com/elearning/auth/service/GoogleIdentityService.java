package com.elearning.auth.service;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.entity.User;
import com.elearning.auth.entity.UserExternalIdentity;
import com.elearning.auth.entity.enums.RoleName;
import com.elearning.auth.repository.RoleRepository;
import com.elearning.auth.repository.UserExternalIdentityRepository;
import com.elearning.auth.repository.UserRepository;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class GoogleIdentityService {

    private final UserRepository users;
    private final RoleRepository roles;
    private final AuthService auth;
    private final Validator validator;
    private final TransactionTemplate transactions;
    private final UserExternalIdentityRepository identities;

    public GoogleIdentityService(
        UserRepository users,
        RoleRepository roles,
        AuthService auth,
        Validator validator,
        PlatformTransactionManager manager,
        UserExternalIdentityRepository identities
    ) {
        this.users = users;
        this.roles = roles;
        this.auth = auth;
        this.validator = validator;
        this.transactions = new TransactionTemplate(manager);
        this.identities = identities;
    }

    // Called only with the OIDC principal authenticated by Spring's Google provider.
    public Profile verifiedProfile(OidcUser principal) {
        String email =
            principal.getEmail() == null ? "" : principal.getEmail().trim().toLowerCase(Locale.ROOT);
        var profile = new Profile(principal.getSubject(), email, null);
        if (!Boolean.TRUE.equals(principal.getEmailVerified()) || !validator.validate(profile).isEmpty()) {
            throw new AppException(ErrorCode.GOOGLE_IDENTITY_INVALID);
        }
        String name = principal.getFullName();
        if (name == null || name.isBlank()) name = email.substring(0, email.indexOf('@'));
        String trimmedName = name.trim();
        int end = trimmedName.offsetByCodePoints(
            0,
            Math.min(trimmedName.codePointCount(0, trimmedName.length()), 100)
        );
        String fullName = trimmedName.substring(0, end);
        return new Profile(profile.subject(), email, fullName);
    }

    public Long resolve(OidcUser principal) {
        var profile = verifiedProfile(principal);
        try {
            return transactions.execute(status -> findOrCreate(profile));
        } catch (DataIntegrityViolationException race) {
            // The losing insert has rolled back before looking up the winning transaction.
            return transactions.execute(status -> {
                var existing = identities.findByProviderAndProviderSubject("GOOGLE", profile.subject());
                if (existing.isPresent()) return checkedId(existing.get().getUser());
                if (users.existsByEmailIgnoreCase(profile.email())) throw new AppException(
                    ErrorCode.GOOGLE_EMAIL_CONFLICT
                );
                throw race;
            });
        }
    }

    private Long findOrCreate(Profile profile) {
        var existing = identities.findByProviderAndProviderSubject("GOOGLE", profile.subject());
        if (existing.isPresent()) return checkedId(existing.get().getUser());
        if (users.existsByEmailIgnoreCase(profile.email())) throw new AppException(
            ErrorCode.GOOGLE_EMAIL_CONFLICT
        );
        var role = roles
            .findByName(RoleName.USER)
            .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        var user = users.saveAndFlush(new User(profile.email(), null, profile.fullName(), role));
        identities.saveAndFlush(new UserExternalIdentity(user, profile.subject(), profile.email()));
        return checkedId(user);
    }

    private Long checkedId(User user) {
        auth.getCurrentUser(user.getId().toString());
        return user.getId();
    }

    public record Profile(
        @NotBlank @Size(max = 255) @Pattern(regexp = "[ -~]+") String subject,
        @NotBlank @Email @Size(max = 254) String email,
        String fullName
    ) {
        @Override
        public String toString() {
            return "GoogleProfile[redacted]";
        }
    }
}
