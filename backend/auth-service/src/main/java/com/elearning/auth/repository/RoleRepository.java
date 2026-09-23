package com.elearning.auth.repository;

import com.elearning.auth.entity.Role;
import com.elearning.auth.entity.enums.RoleName;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Long> {
    Optional<Role> findByName(String name);
    default Optional<Role> findByName(RoleName name) { return findByName(name.name()); }
}
