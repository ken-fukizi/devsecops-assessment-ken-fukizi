import React, { useEffect, useState } from 'react';
import { fetchAllCountries } from '../services/api.js';
import FlagGrid from '../components/FlagGrid.jsx';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const [countries, setCountries] = useState([]);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const getCountries = async () => {
            try {
                const data = await fetchAllCountries();
                setCountries(data);
            } catch (requestError) {
                setError(requestError.message);
            }
        };
        getCountries();
    }, []);

    const handleFlagClick = (countryName) => {
        navigate(`/detail/${countryName}`);
    };

    return (
        <div>
            <h1>Country Flags</h1>
            {error ? <p role="alert">Unable to load countries. Please start the Country API and try again.</p> : null}
            {!error && countries.length === 0 ? <p>Loading countries...</p> : null}
            <FlagGrid countries={countries} onFlagClick={handleFlagClick} />
        </div>
    );
};

export default Home;