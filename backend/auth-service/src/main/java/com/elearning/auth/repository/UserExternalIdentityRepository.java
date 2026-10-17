package com.elearning.auth.repository;

import com.elearning.auth.entity.UserExternalIdentity;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserExternalIdentityRepository extends JpaRepository<UserExternalIdentity, Long> {
    @EntityGraph(attributePaths = { "user", "user.roles" })
    Optional<UserExternalIdentity> findByProviderAndProviderSubject(String provider, String providerSubject);

    Optional<UserExternalIdentity> findByUserIdAndProvider(Long userId, String provider);
}
