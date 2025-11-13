import React, { useState, useEffect } from 'react';
import './PostRequirementForm.css';

function PostRequirementForm({ onSuccessNavigate }) {
  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [formData, setFormData] = useState({
    jobTitle: '',
    clientName: '',
    requirementReceivedDate: '',
    dueDate: '',
    leadRefNumber: '',
    dateOfAllocation: '',
    teamLeader: '',
    location: '',
    pastCompany: '',
    typeOfPosition: '',
    experienceLevel: '',
    relevantExp: '',
    positions: '',
    qualification: '',
    salaryBracket: '',
    shift: '',
    specificGenderRequirement: 'No Preference',
    requirementStatus: 'Open',
    newProject: '',
    jdReceived: '',
    onSiteOpportunity: '',
    involveTraveling: '',
    skills: '',
    jobDescription: '',
    processOfInterview: '',
    requirementOpenSince: '',
    requirementCloseDate: '',
    manager: '',
    markCompleteOnceAllFulfilled: '',
    additionalNotes: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [skillsCount, setSkillsCount] = useState(0);
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const [managerSearchTerm, setManagerSearchTerm] = useState('');
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [loadingTeamLeaders, setLoadingTeamLeaders] = useState(false);
  const [teamLeaderDropdownOpen, setTeamLeaderDropdownOpen] = useState(false);
  const [teamLeaderSearchTerm, setTeamLeaderSearchTerm] = useState('');
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  // Extract and store user_id and role_id from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    const roleId = urlParams.get('role_id');
    
    if (userId) {
      localStorage.setItem('user_id', userId);
    }
    if (roleId) {
      localStorage.setItem('role_id', roleId);
    }
  }, []);

  // Fetch managers when component loads
  useEffect(() => {
    const fetchManagers = async () => {
      setLoadingManagers(true);
      try {
        const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_managers';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        console.log('Managers API Response:', result);
        
        // Handle different response formats from teamob_query
        let managersList = [];
        if (result && result.status === 'success' && result.data && Array.isArray(result.data)) {
          managersList = result.data;
        } else if (Array.isArray(result)) {
          managersList = result;
        } else if (result && result.data && Array.isArray(result.data)) {
          managersList = result.data;
        }
        
        console.log('Parsed managers list:', managersList);
        
        // Transform data - handle both wrapped and unwrapped formats
        const transformedManagers = managersList.map(item => {
          console.log('Processing item:', item);
          
          // Handle the TeamOB response format where:
          // - item[0] contains {fullname: 'name'}
          // - item.users contains {user_id: '4'}
          let user_id = '';
          let fullname = '';
          
          if (item.users && item.users.user_id) {
            user_id = item.users.user_id;
          } else if (item.user_id) {
            user_id = item.user_id;
          }
          
          if (item[0] && item[0].fullname) {
            fullname = item[0].fullname;
          } else if (item.fullname) {
            fullname = item.fullname;
          } else if (item.full_name) {
            fullname = item.full_name;
          }
          
          return {
            user_id: user_id,
            fullname: fullname
          };
        });
        
        console.log('Transformed managers:', transformedManagers);
        
        setManagers(transformedManagers);
      } catch (err) {
        console.error('Error loading managers:', err);
        setManagers([]);
      } finally {
        setLoadingManagers(false);
      }
    };

    fetchManagers();
  }, []);

  // Fetch team leaders when component loads
  useEffect(() => {
    const fetchTeamLeaders = async () => {
      setLoadingTeamLeaders(true);
      try {
        const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_team_leaders';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Handle different response formats from teamob_query
        let teamLeadersList = [];
        if (result && result.status === 'success' && result.data && Array.isArray(result.data)) {
          teamLeadersList = result.data;
        } else if (Array.isArray(result)) {
          teamLeadersList = result;
        } else if (result && result.data && Array.isArray(result.data)) {
          teamLeadersList = result.data;
        }
        
        // Transform data - handle both wrapped and unwrapped formats
        const transformedTeamLeaders = teamLeadersList.map(item => {
          // Handle the TeamOB response format where:
          // - item[0] contains {fullname: 'name'}
          // - item.users contains {user_id: '4'}
          let user_id = '';
          let fullname = '';
          
          if (item.users && item.users.user_id) {
            user_id = item.users.user_id;
          } else if (item.user_id) {
            user_id = item.user_id;
          }
          
          if (item[0] && item[0].fullname) {
            fullname = item[0].fullname;
          } else if (item.fullname) {
            fullname = item.fullname;
          } else if (item.full_name) {
            fullname = item.full_name;
          }
          
          return {
            user_id: user_id,
            fullname: fullname
          };
        });
        
        setTeamLeaders(transformedTeamLeaders);
      } catch (err) {
        console.error('Error loading team leaders:', err);
        setTeamLeaders([]);
      } finally {
        setLoadingTeamLeaders(false);
      }
    };

    fetchTeamLeaders();
  }, []);

  // Fetch clients when component loads
  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/get_clients';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        console.log('Clients API Response:', result);
        
        // Handle different response formats from teamob_query
        let clientsList = [];
        if (result && result.status === 'success' && result.data && Array.isArray(result.data)) {
          clientsList = result.data;
        } else if (Array.isArray(result)) {
          clientsList = result;
        } else if (result && result.data && Array.isArray(result.data)) {
          clientsList = result.data;
        }
        
        console.log('Parsed clients list:', clientsList);
        
        // Transform data - handle both wrapped and unwrapped formats
        const transformedClients = clientsList.map(item => {
          let client_name = '';
          
          // Handle different response formats
          // Check for nested table name structure (e.g., bi_t8s.client_name, bi_t14s.client_name, etc.)
          // The table name is dynamic, so check all keys for client_name property
          if (typeof item === 'object' && item !== null) {
            // First, check if there's a nested object with client_name (teamob_query wraps with table name)
            const keys = Object.keys(item);
            for (let key of keys) {
              if (item[key] && typeof item[key] === 'object' && item[key].client_name) {
                client_name = item[key].client_name;
                break;
              }
            }
            
            // If not found in nested structure, check direct properties
            if (!client_name) {
              if (item[0] && item[0].client_name) {
                client_name = item[0].client_name;
              } else if (item.client_name) {
                client_name = item.client_name;
              }
            }
          } else if (typeof item === 'string') {
            client_name = item;
          }
          
          return {
            client_name: client_name
          };
        }).filter(item => item.client_name && item.client_name.trim() !== '');
        
        console.log('Transformed clients:', transformedClients);
        
        setClients(transformedClients);
      } catch (err) {
        console.error('Error loading clients:', err);
        setClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  // Close manager dropdown when clicking outside
  useEffect(() => {
    if (!managerDropdownOpen) return;
    
    const handleClickOutside = (event) => {
      if (!event.target.closest('.manager-dropdown-wrapper')) {
        setManagerDropdownOpen(false);
        setManagerSearchTerm('');
      }
    };
    
    const handleScroll = (event) => {
      if (!event.target.closest('.manager-custom-dropdown-menu')) {
        setManagerDropdownOpen(false);
        setManagerSearchTerm('');
      }
    };
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [managerDropdownOpen]);

  // Close team leader dropdown when clicking outside
  useEffect(() => {
    if (!teamLeaderDropdownOpen) return;
    
    const handleClickOutside = (event) => {
      if (!event.target.closest('.team-leader-dropdown-wrapper')) {
        setTeamLeaderDropdownOpen(false);
        setTeamLeaderSearchTerm('');
      }
    };
    
    const handleScroll = (event) => {
      if (!event.target.closest('.team-leader-custom-dropdown-menu')) {
        setTeamLeaderDropdownOpen(false);
        setTeamLeaderSearchTerm('');
      }
    };
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [teamLeaderDropdownOpen]);

  // Close client dropdown when clicking outside
  useEffect(() => {
    if (!clientDropdownOpen) return;
    
    const handleClickOutside = (event) => {
      if (!event.target.closest('.client-dropdown-wrapper')) {
        setClientDropdownOpen(false);
        setClientSearchTerm('');
      }
    };
    
    const handleScroll = (event) => {
      if (!event.target.closest('.client-custom-dropdown-menu')) {
        setClientDropdownOpen(false);
        setClientSearchTerm('');
      }
    };
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [clientDropdownOpen]);

  // Filter managers based on search
  const filteredManagers = managers.filter(manager => 
    manager.fullname.toLowerCase().includes(managerSearchTerm.toLowerCase())
  );

  // Filter team leaders based on search
  const filteredTeamLeaders = teamLeaders.filter(leader => 
    leader.fullname.toLowerCase().includes(teamLeaderSearchTerm.toLowerCase())
  );

  // Filter clients based on search
  const filteredClients = clients.filter(client => 
    client.client_name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // Get selected client display text
  const getSelectedClientText = () => {
    if (!formData.clientName) return 'Select Client Name';
    return formData.clientName;
  };

  // Handle client selection
  const handleSelectClient = (clientName) => {
    setFormData(prev => ({ ...prev, clientName: clientName }));
    setClientDropdownOpen(false);
    setClientSearchTerm('');
    // Clear error if exists
    if (errors.clientName) {
      setErrors(prev => ({ ...prev, clientName: '' }));
    }
  };

  // Get selected manager display text
  const getSelectedManagerText = () => {
    if (!formData.manager) return 'Select Manager';
    return formData.manager;
  };

  // Handle manager selection
  const handleSelectManager = (fullname) => {
    setFormData(prev => ({ ...prev, manager: fullname }));
    setManagerDropdownOpen(false);
    setManagerSearchTerm('');
    // Clear error if exists
    if (errors.manager) {
      setErrors(prev => ({ ...prev, manager: '' }));
    }
  };

  // Get selected team leader display text
  const getSelectedTeamLeaderText = () => {
    if (!formData.teamLeader) return 'Select Team Leader';
    return formData.teamLeader;
  };

  // Handle team leader selection
  const handleSelectTeamLeader = (fullname) => {
    setFormData(prev => ({ ...prev, teamLeader: fullname }));
    setTeamLeaderDropdownOpen(false);
    setTeamLeaderSearchTerm('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'skills') {
      setSkillsCount(value.length);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.jobTitle.trim()) newErrors.jobTitle = 'Job Title is required';
    if (!formData.clientName) newErrors.clientName = 'Client Name is required';
    if (!formData.requirementReceivedDate) newErrors.requirementReceivedDate = 'Requirement Received Date is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';
    if (!formData.typeOfPosition) newErrors.typeOfPosition = 'Type of Position is required';
    if (!formData.experienceLevel.trim()) newErrors.experienceLevel = 'Experience Level is required';
    if (!formData.positions) newErrors.positions = 'Number of Positions is required';
    if (!formData.requirementStatus) newErrors.requirementStatus = 'Requirement Status is required';
    if (!formData.newProject) newErrors.newProject = 'Project Status is required';
    if (!formData.jdReceived) newErrors.jdReceived = 'JD Received is required';
    if (!formData.onSiteOpportunity) newErrors.onSiteOpportunity = 'On Site Opportunity is required';
    if (!formData.involveTraveling) newErrors.involveTraveling = 'Traveling requirement is required';
    if (!formData.skills.trim()) newErrors.skills = 'Skills Required is required';
    if (!formData.jobDescription.trim()) newErrors.jobDescription = 'Job Description is required';
    if (!formData.manager) newErrors.manager = 'Manager is required';
    if (!formData.markCompleteOnceAllFulfilled) newErrors.markCompleteOnceAllFulfilled = 'Completion Status is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Get user_id from localStorage
      const userId = localStorage.getItem('user_id');
      
      // API call relative to current path
      const apiUrl = window.location.pathname.replace(/\/$/, '') + '/web/add_requirement';
      
      // Include user_id in the request
      const requestData = {
        ...formData,
        user_id: userId || null
      };
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle different response formats from teamob_query
      // INSERT queries might return success status or just the result
      const isSuccess = result.success === true || 
                       result.status === 'success' || 
                       (result && !result.error && !result.message);
      
      if (isSuccess) {
        // Store bi_primary_id in localStorage if available
        if (result.bi_primary_id) {
          localStorage.setItem('selectedRequirementId', result.bi_primary_id);
        }
        
        // Reset form
        setFormData({
          jobTitle: '',
          clientName: '',
          requirementReceivedDate: '',
          dueDate: '',
          leadRefNumber: '',
          dateOfAllocation: '',
          teamLeader: '',
          location: '',
          pastCompany: '',
          typeOfPosition: '',
          experienceLevel: '',
          relevantExp: '',
          positions: '',
          qualification: '',
          salaryBracket: '',
          shift: '',
          specificGenderRequirement: 'No Preference',
          requirementStatus: 'Open',
          newProject: '',
          jdReceived: '',
          onSiteOpportunity: '',
          involveTraveling: '',
          skills: '',
          jobDescription: '',
          processOfInterview: '',
          requirementOpenSince: '',
          requirementCloseDate: '',
          manager: '',
          markCompleteOnceAllFulfilled: '',
          additionalNotes: ''
        });
        setSkillsCount(0);
        setErrors({});
        
        alert('Requirement posted successfully!');
        
        // Navigate to Campaign page after success
        if (onSuccessNavigate) {
          onSuccessNavigate();
        }
      } else {
        // Handle backend validation errors for duplicate job titles
        if (result.error && result.error.includes('duplicate_job_title')) {
          alert('Error: A requirement with this job title already exists. Please choose a different job title.');
          setErrors(prev => ({ ...prev, jobTitle: 'A requirement with this job title already exists. Please choose a different job title.' }));
        } else {
          throw new Error(result.error || 'Failed to post requirement');
        }
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      alert('Error: ' + (err.message || 'Failed to post requirement'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      jobTitle: '',
      clientName: '',
      requirementReceivedDate: '',
      dueDate: '',
      leadRefNumber: '',
      dateOfAllocation: '',
      teamLeader: '',
      location: '',
      pastCompany: '',
      typeOfPosition: '',
      experienceLevel: '',
      relevantExp: '',
      positions: '',
      qualification: '',
      salaryBracket: '',
      shift: '',
      specificGenderRequirement: 'No Preference',
      requirementStatus: 'Open',
      newProject: '',
      jdReceived: '',
      onSiteOpportunity: '',
      involveTraveling: '',
      skills: '',
      jobDescription: '',
      processOfInterview: '',
      requirementOpenSince: '',
      requirementCloseDate: '',
      manager: '',
      markCompleteOnceAllFulfilled: '',
      additionalNotes: ''
    });
    setSkillsCount(0);
    setErrors({});
  };

  return (
    <div className="requirement-form-page">
      <div className="requirement-form-container">
        <div className="requirement-form-header">
          <h2>Post New Requirement</h2>
          <p>Fill in the details to create a new job requirement</p>
        </div>
        
        <div className="requirement-form-body">
          <form id="requirementForm" onSubmit={handleSubmit}>
            <div className="requirement-form-grid">
              {/* Job Title */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Job Title <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`requirement-form-input ${errors.jobTitle ? 'field-error' : ''}`}
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  placeholder="e.g., Senior Software Engineer - IQ/PR/02"
                  required
                />
                {errors.jobTitle && <span className="field-error-message">{errors.jobTitle}</span>}
              </div>

              {/* Client Name */}
              <div className="requirement-form-group client-dropdown-wrapper">
                <label className="requirement-form-label">
                  Client Name <span className="required">*</span>
                </label>
                <div className={`client-custom-dropdown ${errors.clientName ? 'field-error' : ''}`}>
                  <button
                    type="button"
                    className="client-custom-dropdown-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!loadingClients) setClientDropdownOpen(!clientDropdownOpen);
                    }}
                    disabled={loadingClients}
                  >
                    <span className="client-dropdown-selected-text">
                      {loadingClients ? 'Loading clients...' : getSelectedClientText()}
                    </span>
                    <svg 
                      className={`client-dropdown-arrow ${clientDropdownOpen ? 'open' : ''}`}
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
                  
                  {clientDropdownOpen && (
                    <div className="client-custom-dropdown-menu">
                      <div className="client-dropdown-search-wrapper">
                        <svg 
                          className="client-dropdown-search-icon" 
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
                          className="client-dropdown-search-input"
                          placeholder="Search clients..."
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                          autoFocus
                        />
                        {clientSearchTerm && (
                          <button
                            type="button"
                            className="client-dropdown-clear-search"
                            onClick={() => setClientSearchTerm('')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="client-dropdown-options">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <div
                              key={client.client_name}
                              className={`client-dropdown-option ${formData.clientName === client.client_name ? 'selected' : ''}`}
                              onClick={() => handleSelectClient(client.client_name)}
                            >
                              <div className="client-option-text">
                                {client.client_name}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="client-dropdown-no-results">
                            No clients found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {errors.clientName && <span className="field-error-message">{errors.clientName}</span>}
              </div>

              {/* Requirement Received Date */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Requirement Received Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className={`requirement-form-input ${errors.requirementReceivedDate ? 'field-error' : ''}`}
                  name="requirementReceivedDate"
                  value={formData.requirementReceivedDate}
                  onChange={handleChange}
                  required
                />
                {errors.requirementReceivedDate && <span className="field-error-message">{errors.requirementReceivedDate}</span>}
              </div>

              {/* Due Date */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Due Date</label>
                <input
                  type="date"
                  className="requirement-form-input"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                />
              </div>

              {/* Lead Reference Number */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Lead Reference Number</label>
                <input
                  type="text"
                  className="requirement-form-input"
                  name="leadRefNumber"
                  value={formData.leadRefNumber}
                  onChange={handleChange}
                  placeholder="e.g., LRN-2025-001"
                />
              </div>

              {/* Date of Allocation */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Date of Allocation</label>
                <input
                  type="date"
                  className="requirement-form-input"
                  name="dateOfAllocation"
                  value={formData.dateOfAllocation}
                  onChange={handleChange}
                />
              </div>

              {/* Team Leader */}
              <div className="requirement-form-group team-leader-dropdown-wrapper">
                <label className="requirement-form-label">
                  Team Leader <span className="required">*</span>
                </label>
                <div className={`team-leader-custom-dropdown ${errors.teamLeader ? 'field-error' : ''}`}>
                  <button
                    type="button"
                    className="team-leader-custom-dropdown-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!loadingTeamLeaders) setTeamLeaderDropdownOpen(!teamLeaderDropdownOpen);
                    }}
                    disabled={loadingTeamLeaders}
                  >
                    <span className="team-leader-dropdown-selected-text">
                      {loadingTeamLeaders ? 'Loading team leaders...' : getSelectedTeamLeaderText()}
                    </span>
                    <svg 
                      className={`team-leader-dropdown-arrow ${teamLeaderDropdownOpen ? 'open' : ''}`}
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
                  
                  {teamLeaderDropdownOpen && (
                    <div className="team-leader-custom-dropdown-menu">
                      <div className="team-leader-dropdown-search-wrapper">
                        <svg 
                          className="team-leader-search-icon" 
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
                          className="team-leader-dropdown-search-input"
                          placeholder="Search team leaders..."
                          value={teamLeaderSearchTerm}
                          onChange={(e) => setTeamLeaderSearchTerm(e.target.value)}
                          autoFocus
                        />
                        {teamLeaderSearchTerm && (
                          <button
                            type="button"
                            className="team-leader-clear-search-btn"
                            onClick={() => setTeamLeaderSearchTerm('')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="team-leader-dropdown-options">
                        {filteredTeamLeaders.length > 0 ? (
                          filteredTeamLeaders.map((leader) => (
                            <div
                              key={leader.user_id}
                              className={`team-leader-dropdown-option ${formData.teamLeader === leader.fullname ? 'selected' : ''}`}
                              onClick={() => handleSelectTeamLeader(leader.fullname)}
                            >
                              <div className="team-leader-option-text">
                                {leader.fullname}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="team-leader-dropdown-no-results">
                            No team leaders found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {errors.teamLeader && <span className="field-error-message">{errors.teamLeader}</span>}
              </div>

              {/* Location */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Location <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`requirement-form-input ${errors.location ? 'field-error' : ''}`}
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Bangalore, India"
                  required
                />
                {errors.location && <span className="field-error-message">{errors.location}</span>}
              </div>

              {/* Past Company */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Past Company</label>
                <input
                  type="text"
                  className="requirement-form-input"
                  name="pastCompany"
                  value={formData.pastCompany}
                  onChange={handleChange}
                  placeholder="e.g., Google, Microsoft"
                />
              </div>

              {/* Type of Position */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Type of Position <span className="required">*</span>
                </label>
                <select
                  className={`requirement-form-select ${errors.typeOfPosition ? 'field-error' : ''}`}
                  name="typeOfPosition"
                  value={formData.typeOfPosition}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Type</option>
                  <option value="Replacement">Replacement</option>
                  <option value="On Going Project">On Going Project</option>
                  <option value="New Project">New Project</option>
                </select>
                {errors.typeOfPosition && <span className="field-error-message">{errors.typeOfPosition}</span>}
              </div>

              {/* Experience Level */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Experience Level <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`requirement-form-input ${errors.experienceLevel ? 'field-error' : ''}`}
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleChange}
                  placeholder="e.g., 3-5 years"
                  required
                />
                {errors.experienceLevel && <span className="field-error-message">{errors.experienceLevel}</span>}
              </div>

              {/* Relevant Experience */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Relevant Experience</label>
                <input
                  type="text"
                  className="requirement-form-input"
                  name="relevantExp"
                  value={formData.relevantExp}
                  onChange={handleChange}
                  placeholder="e.g., 3-5 years in Java"
                />
              </div>

              {/* Number of Positions */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Number of Positions <span className="required">*</span>
                </label>
                <input
                  type="number"
                  className={`requirement-form-input ${errors.positions ? 'field-error' : ''}`}
                  name="positions"
                  value={formData.positions}
                  onChange={handleChange}
                  placeholder="e.g., 3"
                  min="1"
                  required
                />
                {errors.positions && <span className="field-error-message">{errors.positions}</span>}
              </div>

              {/* Qualification */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Qualification</label>
                <input
                  type="text"
                  className="requirement-form-input"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  placeholder="e.g., B.Tech, MBA"
                />
              </div>

              {/* Salary Bracket */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Salary Bracket</label>
                <input
                  type="text"
                  className="requirement-form-input"
                  name="salaryBracket"
                  value={formData.salaryBracket}
                  onChange={handleChange}
                  placeholder="e.g., 8-12 LPA"
                />
              </div>

              {/* Shift */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Shift</label>
                <input
                  type="text"
                  className="requirement-form-input"
                  name="shift"
                  value={formData.shift}
                  onChange={handleChange}
                  placeholder="e.g., Day Shift, Night Shift"
                />
              </div>

              {/* Specific Gender Requirement */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Specific Gender Requirement</label>
                <select
                  className="requirement-form-select"
                  name="specificGenderRequirement"
                  value={formData.specificGenderRequirement}
                  onChange={handleChange}
                >
                  <option value="No Preference">No Preference</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Any">Any</option>
                </select>
              </div>

              {/* Requirement Status */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Requirement Status <span className="required">*</span>
                </label>
                <select
                  className={`requirement-form-select ${errors.requirementStatus ? 'field-error' : ''}`}
                  name="requirementStatus"
                  value={formData.requirementStatus}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Status</option>
                  <option value="Open">Open</option>
                  <option value="Hold">Hold</option>
                  <option value="Closed">Closed</option>
                </select>
                {errors.requirementStatus && <span className="field-error-message">{errors.requirementStatus}</span>}
              </div>

              {/* New Project Status */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Project Status <span className="required">*</span>
                </label>
                <select
                  className={`requirement-form-select ${errors.newProject ? 'field-error' : ''}`}
                  name="newProject"
                  value={formData.newProject}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Status</option>
                  <option value="Pipeline">Pipeline</option>
                  <option value="Received">Received</option>
                </select>
                {errors.newProject && <span className="field-error-message">{errors.newProject}</span>}
              </div>

              {/* JD Received */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  JD Received <span className="required">*</span>
                </label>
                <select
                  className={`requirement-form-select ${errors.jdReceived ? 'field-error' : ''}`}
                  name="jdReceived"
                  value={formData.jdReceived}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Option</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                {errors.jdReceived && <span className="field-error-message">{errors.jdReceived}</span>}
              </div>

              {/* On Site Opportunity */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  On Site Opportunity <span className="required">*</span>
                </label>
                <select
                  className={`requirement-form-select ${errors.onSiteOpportunity ? 'field-error' : ''}`}
                  name="onSiteOpportunity"
                  value={formData.onSiteOpportunity}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Option</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                {errors.onSiteOpportunity && <span className="field-error-message">{errors.onSiteOpportunity}</span>}
              </div>

              {/* Does the profile involve traveling */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Does the profile involve traveling <span className="required">*</span>
                </label>
                <select
                  className={`requirement-form-select ${errors.involveTraveling ? 'field-error' : ''}`}
                  name="involveTraveling"
                  value={formData.involveTraveling}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Option</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                {errors.involveTraveling && <span className="field-error-message">{errors.involveTraveling}</span>}
              </div>

              {/* Skills Required */}
              <div className="requirement-form-group full-width">
                <label className="requirement-form-label">
                  Skills Required <span className="required">*</span>
                </label>
                <textarea
                  className={`requirement-form-textarea ${errors.skills ? 'field-error' : ''}`}
                  name="skills"
                  value={formData.skills}
                  onChange={handleChange}
                  placeholder="List the key skills required (e.g., JavaScript, React, Node.js, etc.)"
                  maxLength="200"
                  required
                />
                <span className="requirement-form-helper">Enter skills separated by commas</span>
                <div className="character-counter">
                  <span>{skillsCount}</span>/200 characters
                </div>
                {errors.skills && <span className="field-error-message">{errors.skills}</span>}
              </div>

              {/* Job Description */}
              <div className="requirement-form-group full-width">
                <label className="requirement-form-label">
                  Job Description <span className="required">*</span>
                </label>
                <textarea
                  className={`requirement-form-textarea ${errors.jobDescription ? 'field-error' : ''}`}
                  name="jobDescription"
                  value={formData.jobDescription}
                  onChange={handleChange}
                  placeholder="Provide a detailed job description including responsibilities and requirements..."
                  style={{ minHeight: '150px' }}
                  required
                />
                {errors.jobDescription && <span className="field-error-message">{errors.jobDescription}</span>}
              </div>

              {/* Process of Interview */}
              <div className="requirement-form-group full-width">
                <label className="requirement-form-label">Process of Interview</label>
                <textarea
                  className="requirement-form-textarea"
                  name="processOfInterview"
                  value={formData.processOfInterview}
                  onChange={handleChange}
                  placeholder="Describe the interview process (e.g., Round 1: Phone Screening, Round 2: Technical Interview, Round 3: HR Interview)"
                />
                <span className="requirement-form-helper">Describe the steps involved in the interview process</span>
              </div>

              {/* Requirement Open Since */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Requirement Open Since</label>
                <input
                  type="text"
                  className="requirement-form-input"
                  name="requirementOpenSince"
                  value={formData.requirementOpenSince}
                  onChange={handleChange}
                  placeholder="e.g., 2 weeks, 1 month"
                />
              </div>

              {/* Requirement Close Date */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">Requirement Close Date</label>
                <input
                  type="date"
                  className="requirement-form-input"
                  name="requirementCloseDate"
                  value={formData.requirementCloseDate}
                  onChange={handleChange}
                />
              </div>

              {/* Manager */}
              <div className="requirement-form-group manager-dropdown-wrapper">
                <label className="requirement-form-label">
                  Manager <span className="required">*</span>
                </label>
                <div className={`manager-custom-dropdown ${errors.manager ? 'field-error' : ''}`}>
                  <button
                    type="button"
                    className="manager-custom-dropdown-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!loadingManagers) setManagerDropdownOpen(!managerDropdownOpen);
                    }}
                    disabled={loadingManagers}
                  >
                    <span className="manager-dropdown-selected-text">
                      {loadingManagers ? 'Loading managers...' : getSelectedManagerText()}
                    </span>
                    <svg 
                      className={`manager-dropdown-arrow ${managerDropdownOpen ? 'open' : ''}`}
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
                  
                  {managerDropdownOpen && (
                    <div className="manager-custom-dropdown-menu">
                      <div className="manager-dropdown-search-wrapper">
                        <svg 
                          className="manager-search-icon" 
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
                          className="manager-dropdown-search-input"
                          placeholder="Search managers..."
                          value={managerSearchTerm}
                          onChange={(e) => setManagerSearchTerm(e.target.value)}
                          autoFocus
                        />
                        {managerSearchTerm && (
                          <button
                            type="button"
                            className="manager-clear-search-btn"
                            onClick={() => setManagerSearchTerm('')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="manager-dropdown-options">
                        {filteredManagers.length > 0 ? (
                          filteredManagers.map((manager) => (
                            <div
                              key={manager.user_id}
                              className={`manager-dropdown-option ${formData.manager === manager.fullname ? 'selected' : ''}`}
                              onClick={() => handleSelectManager(manager.fullname)}
                            >
                              <div className="manager-option-text">
                                {manager.fullname}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="manager-dropdown-no-results">
                            No managers found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {errors.manager && <span className="field-error-message">{errors.manager}</span>}
              </div>

              {/* Mark Complete Once All Fulfilled */}
              <div className="requirement-form-group">
                <label className="requirement-form-label">
                  Completion Status <span className="required">*</span>
                </label>
                <select
                  className={`requirement-form-select ${errors.markCompleteOnceAllFulfilled ? 'field-error' : ''}`}
                  name="markCompleteOnceAllFulfilled"
                  value={formData.markCompleteOnceAllFulfilled}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Status</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                {errors.markCompleteOnceAllFulfilled && <span className="field-error-message">{errors.markCompleteOnceAllFulfilled}</span>}
              </div>

              {/* Additional Notes */}
              <div className="requirement-form-group full-width">
                <label className="requirement-form-label">Additional Notes (Optional)</label>
                <textarea
                  className="requirement-form-textarea"
                  name="additionalNotes"
                  value={formData.additionalNotes}
                  onChange={handleChange}
                  placeholder="Any additional information or special requirements..."
                />
              </div>
            </div>

            <div className="requirement-form-actions">
              <button
                type="button"
                className="requirement-btn requirement-btn-cancel"
                onClick={handleCancel}
              >
                Reset Form
              </button>
              <button
                type="submit"
                className="requirement-btn requirement-btn-submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                    Submit Requirement
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PostRequirementForm;

