package com.lootchat.LootChat.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.util.StringUtils;

import java.util.UUID;

/**
 * Custom CSRF token repository that stores tokens in cookies
 * and reads them from both cookies and headers
 */
public class CookieCsrfTokenRepository implements CsrfTokenRepository {

    private static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String CSRF_HEADER_NAME = "X-XSRF-TOKEN";
    private static final String CSRF_PARAMETER_NAME = "_csrf";

    @Override
    public CsrfToken generateToken(HttpServletRequest request) {
        return new DefaultCsrfToken(CSRF_HEADER_NAME, CSRF_PARAMETER_NAME, UUID.randomUUID().toString());
    }

    @Override
    public void saveToken(CsrfToken token, HttpServletRequest request, HttpServletResponse response) {
        String tokenValue = (token != null) ? token.getToken() : "";
        
        if (tokenValue.isEmpty()) {
            response.addHeader("Set-Cookie", String.format(
                "%s=; Path=/; Max-Age=0; SameSite=Strict",
                CSRF_COOKIE_NAME
            ));
        } else {
            response.addHeader("Set-Cookie", String.format(
                "%s=%s; Path=/; Max-Age=3600; SameSite=Strict",
                CSRF_COOKIE_NAME,
                tokenValue
            ));
        }
    }

    @Override
    public CsrfToken loadToken(HttpServletRequest request) {
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if (CSRF_COOKIE_NAME.equals(cookie.getName())) {
                    String token = cookie.getValue();
                    if (StringUtils.hasText(token)) {
                        return new DefaultCsrfToken(CSRF_HEADER_NAME, CSRF_PARAMETER_NAME, token);
                    }
                }
            }
        }
        return null;
    }
}
