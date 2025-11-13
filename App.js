import React, { useState, useEffect } from 'react';
import './App.css';
import PostRequirementForm from './components/PostRequirementForm';

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState('post-requirement'); // Default to post requirement page
  const [requirements, setRequirements] = useState([]);
  const [selectedRequirement, setSelectedRequirement] = useState('');
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [postingOptions, setPostingOptions] = useState({
    linkedinPosting: false,
    facebookPosting: false,
    twitterPosting: false,
    linkedinScraper: false,
    githubScraper: false,
    linkedinMessaging: false
  });
  const [showPostingOptions, setShowPostingOptions] = useState(false);
  const [campaignExists, setCampaignExists] = useState(false);
  const [loadingCampaignStatus, setLoadingCampaignStatus] = useState(false);
  const [campaignFeatures, setCampaignFeatures] = useState([]);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);
  const [selectedCampaignOptions, setSelectedCampaignOptions] = useState({
    linkedinPosting: false,
    facebookPosting: false,
    twitterPosting: false,
    linkedinScraper: false,
    githubScraper: false,
    linkedinMessaging: false
  });
  const [accessError, setAccessError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');

    if (userId && userId.trim() !== '') {
      localStorage.setItem('user_id', userId);
      return null;
    }

    return 'Please log in to CRM to access this page.';
  });
  const [currentUserName, setCurrentUserName] = useState('');
  const [campaignSuccessMessage, setCampaignSuccessMessage] = useState('');

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const storedUserId = localStorage.getItem('user_id');
        if (!storedUserId || storedUserId.trim() === '') {
          return;
        }

        const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_user_name';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: storedUserId
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result && (result.success || result.status === 'success')) {
          const name = result.full_name || (result.data && result.data.full_name) || '';
          if (name) {
            setCurrentUserName(name);
          }
        }
      } catch (err) {
        console.error('Error fetching user name:', err);
      }
    };

    if (!accessError) {
      fetchUserName();
    }
  }, [accessError]);

  if (accessError) {
    return (
      <div className="App access-error-container">
        <div className="access-error-card">
          <h1>Access Required</h1>
          <p>{accessError}</p>
          <p className="access-error-subtext">Please log in to the CRM and open this page again.</p>
        </div>
      </div>
    );
  }

  const handleLoadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // API calls relative to current path
      const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_users';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract the array inside "data" and flatten user objects
      const usersArray = data.data || [];
      const usersList = [];
      
      usersArray.forEach(item => {
        if (item.users) {
          usersList.push(item.users);
        }
      });
      
      setUsers(usersList);
    } catch (err) {
      setError(err.message || 'Error fetching users');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load requirements when campaign page is opened
  useEffect(() => {
    if (currentPage === 'campaign' && !accessError) {
      handleLoadRequirements();
    }
  }, [currentPage, accessError]);

  // Auto-select requirement from localStorage after requirements are loaded
  useEffect(() => {
    if (currentPage === 'campaign' && requirements.length > 0 && !selectedRequirement) {
      const storedId = localStorage.getItem('selectedRequirementId');
      if (storedId) {
        // Check if the stored ID exists in requirements
        const foundReq = requirements.find(req => req.id == storedId);
        if (foundReq) {
          setSelectedRequirement(storedId);
          // Clear localStorage after selection
          localStorage.removeItem('selectedRequirementId');
        }
      }
    }
  }, [requirements, currentPage, selectedRequirement]);

  const handleLoadRequirements = async () => {
    setLoadingRequirements(true);
    try {
      // Get user_id from localStorage
      const userId = localStorage.getItem('user_id');

      if (!userId || userId.trim() === '') {
        setAccessError(prev => prev || 'Please log in to CRM to access this page.');
        return;
      }
      
      const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_requirements';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId || null
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle different response formats from teamob_query
      let requirementsList = [];
      if (result && result.status === 'success' && result.data && Array.isArray(result.data)) {
        // Format: { status: 'success', data: [...] }
        requirementsList = result.data;
      } else if (Array.isArray(result)) {
        // Format: [...] (direct array)
        requirementsList = result;
      } else if (result && result.data && Array.isArray(result.data)) {
        // Format: { data: [...] }
        requirementsList = result.data;
      }
      
      // Transform data - handle both wrapped and unwrapped formats
      const transformedRequirements = requirementsList.map(item => {
        // Data might be wrapped in table name like { bi_t14s: {...} }
        const reqData = item.bi_t14s || item;
        return {
          id: reqData.bi_primary_id || reqData.id,
          requirement_name: reqData.requirement_name || reqData.job_title || '',
          client_name: reqData.client_name || '',
          job_location: reqData.job_location || reqData.location || '',
          requirement_status: reqData.requirement_status || ''
        };
      });
      
      setRequirements(transformedRequirements);
    } catch (err) {
      console.error('Error loading requirements:', err);
      setRequirements([]);
    } finally {
      setLoadingRequirements(false);
    }
  };

  const handleSetup = async () => {
    if (!selectedRequirement) {
      alert('Please select a requirement first');
      return;
    }
    
    // Check campaign status
    setLoadingCampaignStatus(true);
    try {
      const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_campaign_status';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirement_id: selectedRequirement
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const exists = result.campaign_exists || false;
        setCampaignExists(exists);
        // Show posting options section
        setShowPostingOptions(true);
        
        // Set selected options from campaign (if exists)
        if (exists && result.selected_options) {
          setSelectedCampaignOptions(result.selected_options);
        } else {
          setSelectedCampaignOptions({
            linkedinPosting: false,
            facebookPosting: false,
            twitterPosting: false,
            linkedinScraper: false,
            githubScraper: false
          });
        }
        
        // If campaign exists, fetch features from API
        if (exists) {
          fetchCampaignFeatures(selectedRequirement);
        } else {
          setCampaignFeatures([]);
        }
      } else {
        console.error('Error checking campaign status:', result.error);
        // Default to showing checkboxes if there's an error
        setCampaignExists(false);
        setShowPostingOptions(true);
      }
    } catch (err) {
      console.error('Error checking campaign status:', err);
      // Default to showing checkboxes if there's an error
      setCampaignExists(false);
      setShowPostingOptions(true);
    } finally {
      setLoadingCampaignStatus(false);
    }
  };

  // Fetch campaign features from API
  const fetchCampaignFeatures = async (requirementId) => {
    try {
      const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_campaign_features';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirement_id: requirementId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.features) {
        // Features already include profile counts from backend
        setCampaignFeatures(result.features);
      } else {
        console.error('Error fetching campaign features:', result.error);
        setCampaignFeatures([]);
      }
    } catch (err) {
      console.error('Error fetching campaign features:', err);
      setCampaignFeatures([]);
    }
  };

  // Handle campaign submission
  const handleSubmitCampaign = async () => {
    if (!selectedRequirement) {
      alert('Please select a requirement first');
      return;
    }
    
    // Check if at least one option is selected
    const hasSelection = postingOptions.linkedinPosting || 
                         postingOptions.facebookPosting || 
                         postingOptions.twitterPosting || 
                         postingOptions.linkedinScraper || 
                         postingOptions.githubScraper ||
                         postingOptions.linkedinMessaging;
    
    if (!hasSelection) {
      alert('Please select at least one posting option');
      return;
    }
    
    setSubmittingCampaign(true);
    try {
      const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/create_campaign';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirement_id: selectedRequirement,
          linkedinPosting: postingOptions.linkedinPosting,
          facebookPosting: postingOptions.facebookPosting,
          twitterPosting: postingOptions.twitterPosting,
          linkedinScraper: postingOptions.linkedinScraper,
          githubScraper: postingOptions.githubScraper,
          linkedinMessaging: postingOptions.linkedinMessaging
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const selectedRequirementData = requirements.find(req => req.id === selectedRequirement);
        const requirementNameText = selectedRequirementData
          ? (selectedRequirementData.requirement_name || selectedRequirementData.client_name || '').trim()
          : '';
        const messageRequirementName = requirementNameText !== '' ? requirementNameText : 'the selected requirement name';
        setCampaignSuccessMessage(`Campaign created successfully and the job title you need to use is "${messageRequirementName}". Copy this requirement name and use it everywhere to post the job.`);
        
        // Reset all campaign-related state to reload the page
        setSelectedRequirement('');
        setShowPostingOptions(false);
        setCampaignExists(false);
        setCampaignFeatures([]);
        setSelectedCampaignOptions({
          linkedinPosting: false,
          facebookPosting: false,
          twitterPosting: false,
          linkedinScraper: false,
          githubScraper: false,
          linkedinMessaging: false
        });
        setPostingOptions({
          linkedinPosting: false,
          facebookPosting: false,
          twitterPosting: false,
          linkedinScraper: false,
          githubScraper: false,
          linkedinMessaging: false
        });
        setSearchTerm('');
        setDropdownOpen(false);
      } else {
        alert('Error: ' + (result.error || 'Failed to create campaign'));
      }
    } catch (err) {
      console.error('Error creating campaign:', err);
      alert('Error creating campaign: ' + err.message);
    } finally {
      setSubmittingCampaign(false);
    }
  };

  const resolvedUserName = (currentUserName && currentUserName.trim() !== '') ? currentUserName.trim() : 'User';
  const resolvedUserInitial = resolvedUserName.charAt(0).toUpperCase();

  const filteredRequirements = requirements.filter(req => {
    const searchLower = searchTerm.toLowerCase();
    const reqName = (req.requirement_name || '').toLowerCase();
    const clientName = (req.client_name || '').toLowerCase();
    return reqName.includes(searchLower) || clientName.includes(searchLower);
  });

  // Get selected requirement display text
  const getSelectedText = () => {
    if (!selectedRequirement) return 'Select Requirement';
    const selected = requirements.find(req => req.id === selectedRequirement);
    return selected ? (selected.requirement_name || selected.client_name || `Requirement ${selected.id}`) : 'Select Requirement';
  };

  const handleSelectRequirement = (reqId) => {
    setSelectedRequirement(reqId);
    setDropdownOpen(false);
    setSearchTerm('');
    // Reset posting options visibility and campaign status when requirement changes
    setShowPostingOptions(false);
    setCampaignExists(false);
    setCampaignFeatures([]);
    setSelectedCampaignOptions({
      linkedinPosting: false,
      facebookPosting: false,
      twitterPosting: false,
      linkedinScraper: false,
      githubScraper: false,
      linkedinMessaging: false
    });
    setCampaignSuccessMessage('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    
    const handleClickOutside = (event) => {
      if (!event.target.closest('.requirement-dropdown-wrapper')) {
        setDropdownOpen(false);
        setSearchTerm('');
      }
    };
    
    const handleScroll = (event) => {
      // Only close if scrolling outside the dropdown
      if (!event.target.closest('.custom-dropdown-menu')) {
        setDropdownOpen(false);
        setSearchTerm('');
      }
    };
    
    // Add a small delay before attaching the listener to prevent immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [dropdownOpen]);

  return (
    <div className="App">
      <header className="app-header">
        <nav className="header-nav">
          <div className="header-nav-left">
            <button 
              className={`header-menu-btn post-requirement-btn ${currentPage === 'post-requirement' ? 'active' : ''}`}
              onClick={() => setCurrentPage('post-requirement')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <span>Post Requirement</span>
            </button>
            
            <button 
              className={`header-menu-btn campaign-btn ${currentPage === 'campaign' ? 'active' : ''}`}
              onClick={() => setCurrentPage('campaign')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span>Campaign</span>
            </button>
          </div>

          {!accessError && (
            <div className="header-user-info">
              <div className="header-user-avatar">
                {resolvedUserInitial}
              </div>
              <div className="header-user-details">
                <span className="header-user-label">Logged in as</span>
                <span className="header-user-name">{resolvedUserName}</span>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main className="app-main">
        {currentPage === 'post-requirement' ? (
          <PostRequirementForm onSuccessNavigate={() => setCurrentPage('campaign')} />
        ) : (
          <div className="campaign-page">
            <div className="campaign-controls">
              <div className="requirement-dropdown-wrapper">
                <label className="requirement-label">
                  Requirement Name
                </label>
                <p className="requirement-help-text">
                  Select a job requirement from the list below. After selecting, click the "Load" button to view and manage the posting settings for that requirement.
                </p>
                <div className="custom-dropdown">
                  <button
                    type="button"
                    className="custom-dropdown-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!loadingRequirements) setDropdownOpen(!dropdownOpen);
                    }}
                    disabled={loadingRequirements}
                  >
                    <span className="dropdown-selected-text">
                      {loadingRequirements ? 'Loading...' : getSelectedText()}
                    </span>
                    <svg 
                      className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                  
                  {dropdownOpen && (
                    <div className="custom-dropdown-menu">
                      <div className="dropdown-search-wrapper">
                        <svg 
                          className="search-icon" 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <input
                          type="text"
                          className="dropdown-search-input"
                          placeholder="Search requirements..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          autoFocus
                        />
                        {searchTerm && (
                          <button
                            type="button"
                            className="clear-search-btn"
                            onClick={() => setSearchTerm('')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="dropdown-options">
                        {filteredRequirements.length > 0 ? (
                          filteredRequirements.map((req) => (
                            <div
                              key={req.id}
                              className={`dropdown-option ${selectedRequirement === req.id ? 'selected' : ''}`}
                              onClick={() => handleSelectRequirement(req.id)}
                            >
                              <div className="option-main-text">
                                {req.requirement_name || req.client_name || `Requirement ${req.id}`}
                              </div>
                              {req.client_name && req.requirement_name && (
                                <div className="option-sub-text">{req.client_name}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="dropdown-no-results">
                            No requirements found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                className="setup-btn"
                onClick={handleSetup}
                disabled={!selectedRequirement || loadingRequirements || loadingCampaignStatus}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                Load
              </button>
            </div>

            {campaignSuccessMessage && (
              <div className="campaign-success-message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                <p>{campaignSuccessMessage}</p>
              </div>
            )}

            {showPostingOptions && (
              <div className="posting-options-section">
                <label className="posting-options-label">Posting Options</label>
                <p className="posting-options-help-text">
                  Choose where you want to advertise this job requirement or where you want to search for candidates. You can select one or more options. For example, you can post the job on social media platforms like LinkedIn, Facebook, or Twitter, or you can search for candidates on LinkedIn and GitHub.
                </p>
                <div className="posting-options-grid">
                {campaignExists ? (
                  // Show tick marks (read-only) only for selected options when campaign exists
                  <>
                    {selectedCampaignOptions.linkedinPosting && (
                      <div className="posting-option-tick">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="tick-icon">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        <span className="checkbox-label">LinkedIn Posting</span>
                      </div>
                    )}
                    
                    {selectedCampaignOptions.facebookPosting && (
                      <div className="posting-option-tick">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="tick-icon">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        <span className="checkbox-label">Facebook Posting</span>
                      </div>
                    )}
                    
                    {selectedCampaignOptions.twitterPosting && (
                      <div className="posting-option-tick">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="tick-icon">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        <span className="checkbox-label">X (Twitter) Posting</span>
                      </div>
                    )}
                    
                    {selectedCampaignOptions.linkedinScraper && (
                      <div className="posting-option-tick">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="tick-icon">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        <span className="checkbox-label">LinkedIn Scraper</span>
                      </div>
                    )}
                    
                    {selectedCampaignOptions.githubScraper && (
                      <div className="posting-option-tick">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="tick-icon">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        <span className="checkbox-label">Github Scraper</span>
                      </div>
                    )}
                    
                    {selectedCampaignOptions.linkedinMessaging && (
                      <div className="posting-option-tick">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="tick-icon">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        <span className="checkbox-label">LinkedIn Messaging</span>
                      </div>
                    )}
                  </>
                ) : (
                  // Show checkboxes (editable) when campaign doesn't exist
                  <>
                    <label className="posting-option-checkbox">
                      <input
                        type="checkbox"
                        checked={postingOptions.linkedinPosting}
                        onChange={(e) => setPostingOptions(prev => ({ ...prev, linkedinPosting: e.target.checked }))}
                      />
                      <span className="checkbox-label">LinkedIn Posting</span>
                    </label>
                    
                    <label className="posting-option-checkbox">
                      <input
                        type="checkbox"
                        checked={postingOptions.facebookPosting}
                        onChange={(e) => setPostingOptions(prev => ({ ...prev, facebookPosting: e.target.checked }))}
                      />
                      <span className="checkbox-label">Facebook Posting</span>
                    </label>
                    
                    <label className="posting-option-checkbox">
                      <input
                        type="checkbox"
                        checked={postingOptions.twitterPosting}
                        onChange={(e) => setPostingOptions(prev => ({ ...prev, twitterPosting: e.target.checked }))}
                      />
                      <span className="checkbox-label">X (Twitter) Posting</span>
                    </label>
                    
                    <label className="posting-option-checkbox">
                      <input
                        type="checkbox"
                        checked={postingOptions.linkedinScraper}
                        onChange={(e) => setPostingOptions(prev => ({ ...prev, linkedinScraper: e.target.checked }))}
                      />
                      <span className="checkbox-label">LinkedIn Scraper</span>
                    </label>
                    
                    <label className="posting-option-checkbox">
                      <input
                        type="checkbox"
                        checked={postingOptions.githubScraper}
                        onChange={(e) => setPostingOptions(prev => ({ ...prev, githubScraper: e.target.checked }))}
                      />
                      <span className="checkbox-label">Github Scraper</span>
                    </label>
                    
                    <label className="posting-option-checkbox">
                      <input
                        type="checkbox"
                        checked={postingOptions.linkedinMessaging}
                        onChange={(e) => setPostingOptions(prev => ({ ...prev, linkedinMessaging: e.target.checked }))}
                      />
                      <span className="checkbox-label">LinkedIn Messaging</span>
                    </label>
                  </>
                )}
              </div>
                {/* Submit button - only show when campaign doesn't exist */}
                {!campaignExists && (
                  <div className="posting-options-submit-wrapper">
                    <button
                      className="posting-options-submit-btn"
                      onClick={handleSubmitCampaign}
                      disabled={submittingCampaign || !selectedRequirement}
                    >
                      {submittingCampaign ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stats Section - Only show when campaign exists */}
            {campaignExists && showPostingOptions && (
              <div className="campaign-stats-section">
                <label className="campaign-stats-label">Stats</label>
                <p className="stats-help-text">
                This table displays the total number of profiles found on LinkedIn and GitHub. AI is used to scrape these profiles, and the results are shown here. During the scraping process, the AI also automatically sends messages to profiles whose email addresses are available.
                </p>
                <div className="stats-table-container">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th className="stats-header-feature">Feature</th>
                        <th className="stats-header-value">Profiles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignFeatures.length > 0 ? (
                        campaignFeatures.map((stat, index) => (
                          <tr key={index} className="stats-row">
                            <td className="stats-feature">{stat.feature}</td>
                            <td className="stats-value">{stat.profiles || 0}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" className="stats-no-data">No features available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                Error: {error}
              </div>
            )}

            <ul id="userList">
              {users.map((user, index) => (
                <li key={user.user_id || index}>
                  {user.user_id} - {user.first_name} {user.last_name} ({user.email})
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

