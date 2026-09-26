package com.elearning.auth.repository;

import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.UserStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {
    @EntityGraph(attributePaths = "roles")
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @Override
    @EntityGraph(attributePaths = "roles")
    Optional<User> findById(Long id);

    @Query(
        "SELECT u FROM User u WHERE " +
            "(:status IS NULL OR u.status = :status) AND " +
            "(:role IS NULL OR EXISTS (SELECT r.id FROM u.roles r WHERE r.name = :role)) AND " +
            "(:keyword IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))"
    )
    Page<User> findByFilter(
        @Param("keyword") String keyword,
        @Param("status") UserStatus status,
        @Param("role") String role,
        Pageable pageable
    );
}
