package org.bongz.countryservice.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.bongz.countryservice.model.ApiCountry;
import org.bongz.countryservice.model.Country;
import org.bongz.countryservice.repository.CountryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.util.Arrays;
import java.util.Optional;

@Profile("dev")
@Component
public class DataLoader implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataLoader.class);
    private static final String RESTCOUNTRIES_URL =
            "https://restcountries.com/v3.1/all?fields=name,flags,capital,population";
    private static final String BUNDLED_SEED = "seed/countries.json";

    private final CountryRepository countryRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public DataLoader(
            CountryRepository countryRepository,
            RestTemplate restTemplate,
            ObjectMapper objectMapper) {
        this.countryRepository = countryRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        ApiCountry[] apiCountries = fetchRemoteCountries();
        String source = RESTCOUNTRIES_URL;

        if (apiCountries == null || apiCountries.length == 0) {
            apiCountries = loadBundledSeed();
            source = "classpath:" + BUNDLED_SEED;
        }

        if (apiCountries == null || apiCountries.length == 0) {
            logger.error("No country seed data available");
            return;
        }

        int saved = saveCountries(apiCountries);
        logger.info("Seeded {} countries from {}", saved, source);
    }

    private ApiCountry[] fetchRemoteCountries() {
        try {
            ApiCountry[] apiCountries = restTemplate.getForObject(RESTCOUNTRIES_URL, ApiCountry[].class);
            if (apiCountries != null && apiCountries.length > 0) {
                return apiCountries;
            }
            logger.warn("Remote country API returned no data: {}", RESTCOUNTRIES_URL);
        } catch (Exception e) {
            logger.warn("Remote country API unavailable ({}), using bundled seed: {}",
                    RESTCOUNTRIES_URL, e.getMessage());
        }
        return null;
    }

    private ApiCountry[] loadBundledSeed() {
        try (InputStream inputStream = new ClassPathResource(BUNDLED_SEED).getInputStream()) {
            return objectMapper.readValue(inputStream, ApiCountry[].class);
        } catch (Exception e) {
            logger.error("Failed to load bundled country seed", e);
            return null;
        }
    }

    private int saveCountries(ApiCountry[] apiCountries) {
        return (int) Arrays.stream(apiCountries)
                .map(this::toCountry)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .peek(countryRepository::save)
                .count();
    }

    private Optional<Country> toCountry(ApiCountry apiCountry) {
        try {
            String name = Optional.ofNullable(apiCountry.getName())
                    .map(ApiCountry.Name::getCommon)
                    .orElse("N/A");
            String flag = Optional.ofNullable(apiCountry.getFlags())
                    .map(ApiCountry.Flags::getPng)
                    .orElse("N/A");
            String capital = Optional.ofNullable(apiCountry.getCapital())
                    .filter(caps -> !caps.isEmpty())
                    .map(caps -> caps.get(0))
                    .orElse("N/A");
            return Optional.of(new Country(name, flag, apiCountry.getPopulation(), capital));
        } catch (Exception e) {
            logger.error("Error processing country data: {}", apiCountry, e);
            return Optional.empty();
        }
    }
}
