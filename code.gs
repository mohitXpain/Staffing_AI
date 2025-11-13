/**
 * Google Apps Script Web App - Real Authentication System
 * 
 * This file contains the server-side logic for handling web requests
 * and real user authentication using external API.
 */

// Base URL configuration - change this once to update all API calls
var BASE_URL = 'https://iquest.teamob.in/';

// Helper function to build API URLs
function buildApiUrl(endpoint) {
  return BASE_URL + endpoint;
}

/**
 * Handles GET requests to serve the appropriate HTML page
 * This function is called when users access the web app URL
 * 
 * @param {Object} e - The event object containing request parameters
 * @return {HtmlOutput} The HTML content to display
 */
function doGet(e) {
  try {
    console.log('doGet called - serving merged app');
    
    // Serve the merged app.html file
    return HtmlService.createTemplateFromFile('app')
      .evaluate()
      .setTitle('TeamOB - RecruitPro')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    // Log error and return a simple error page
    console.error('Error in doGet:', error);
    return HtmlService.createHtmlOutput(`
      <html>
        <head>
          <title>Error - TeamOB - RecruitPro</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
          <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
            <h1 style="color: #e74c3c;">Error</h1>
            <p>An error occurred while loading the page.</p>
            <p>Please try again later.</p>
            <p style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
              Error details: ${error.toString()}
            </p>
            <button onclick="location.reload()" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Reload Page
            </button>
          </div>
        </body>
      </html>
    `);
  }
}

/**
 * Get current request time in formatted string
 * @return {string} Formatted date string for API requests
 */
function getCurrentRequestTime() {
  var now = new Date();
  var yyyy = now.getFullYear();
  var mm = ('0' + (now.getMonth() + 1)).slice(-2);
  var dd = ('0' + now.getDate()).slice(-2);
  var HH = ('0' + now.getHours()).slice(-2);
  var MI = ('0' + now.getMinutes()).slice(-2);
  var SS = ('0' + now.getSeconds()).slice(-2);
  return yyyy + '-' + mm + '-' + dd + ' ' + HH + ':' + MI + ':' + SS;
}

/**
 * Generate X-Code for API authentication
 * @param {string} message - Message to sign
 * @param {string} secretKey - Secret key for signing
 * @return {string} Hex-encoded signature
 */
function generateXCode(message, secretKey) {
  secretKey = secretKey || "teamobE2020M";
  var signature = Utilities.computeHmacSha256Signature(message, secretKey);
  return signature.reduce(function (str, byte) {
    return str + ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }, '');
}

/**
 * Hash password using MD5 (for compatibility with existing system)
 * @param {string} password - Password to hash
 * @return {string} Hex-encoded MD5 hash
 */
function hashPassword(password) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, password)
    .map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    })
    .join('');
}

/**
 * Create database connection to MySQL database
 * @return {Object} Database connection object with execute method
 */
function createDatabaseConnection() {
  try {
    // Database connection parameters
    var dbConfig = {
      host: '157.245.106.137',
      port: 3306,
      database: 'ob_iquest',
      username: 'iquestuser',
      password: 'Development$#2023'
    };
    
    // Create connection string
    var connectionString = 'jdbc:mysql://' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database;
    
    console.log('Connecting to database:', connectionString);
    
    // Establish connection
    var connection = Jdbc.getConnection(connectionString, dbConfig.username, dbConfig.password);
    
    console.log('Database connection established successfully');
    
    // Return connection object with execute method
    return {
      connection: connection,
      execute: function(query, params) {
        try {
          console.log('Executing query:', query);
          console.log('Parameters:', params);
          
          var statement = connection.prepareStatement(query);
          
          // Set parameters if provided
          if (params && params.length > 0) {
            for (var i = 0; i < params.length; i++) {
              statement.setObject(i + 1, params[i]);
            }
          }
          
          // Execute query
          var isSelect = query.trim().toUpperCase().startsWith('SELECT');
          var result;
          
          if (isSelect) {
            var resultSet = statement.executeQuery();
            var results = [];
            var metaData = resultSet.getMetaData();
            var columnCount = metaData.getColumnCount();
            
            while (resultSet.next()) {
              var row = {};
              for (var i = 1; i <= columnCount; i++) {
                var columnName = metaData.getColumnName(i);
                var columnValue = resultSet.getObject(i);
                row[columnName] = columnValue;
              }
              results.push(row);
            }
            result = results;
          } else {
            result = statement.executeUpdate();
          }
          
          statement.close();
          return {
            success: true,
            data: result,
            affectedRows: isSelect ? 0 : result
          };
          
        } catch (error) {
          console.error('Query execution error:', error);
          return {
            success: false,
            error: error.toString()
          };
        }
      },
      close: function() {
        try {
          if (connection) {
            connection.close();
            console.log('Database connection closed');
          }
        } catch (error) {
          console.error('Error closing connection:', error);
        }
      }
    };
    
  } catch (error) {
    console.error('Database connection error:', error);
    return {
      success: false,
      error: error.toString(),
      execute: function() {
        return { success: false, error: 'No database connection' };
      },
      close: function() {}
    };
  }
}

/**
 * Fetch data from API
 * @param {string} query - SQL query to execute
 * @param {string} requestTime - Request timestamp
 * @return {Array} Query results
 */
function fetchFromAPI(query, requestTime) {
  try {
    requestTime = requestTime || getCurrentRequestTime();
    var endpoint = "apis/getQueryData/?request_time=" + requestTime;
    var url = buildApiUrl(endpoint);
    var xcode = generateXCode(endpoint);
    
    // Get current user email from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var userEmail = scriptProperties.getProperty('email');
    
    console.log('API URL:', url);
    console.log('Query:', query);
    console.log('User email:', userEmail);
    
    var options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        query: query,
        email: userEmail
      },
      headers: {
        "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
        "X-Code": xcode,
        "X-Request-Time": requestTime
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    
    console.log('Raw response:', responseText);
    console.log('Response length:', responseText.length);
    
    // Check if response is empty or invalid
    if (!responseText || responseText.trim() === '') {
      console.log('Empty response from API');
      return [];
    }
    
    // Handle multiple JSON objects in response
    var json;
    try {
      // Try to parse as single JSON first
      json = JSON.parse(responseText);
    } catch (e) {
      // If that fails, try to handle multiple JSON objects
      console.log('Single JSON parsing failed, trying to handle multiple objects');
      
      // Split by }{ and add proper JSON array formatting
      var jsonObjects = responseText.split('}{');
      if (jsonObjects.length > 1) {
        // Add missing braces and create array
        var fixedJson = '[';
        for (var i = 0; i < jsonObjects.length; i++) {
          if (i > 0) fixedJson += ',';
          if (i === 0) {
            fixedJson += jsonObjects[i] + '}';
          } else if (i === jsonObjects.length - 1) {
            fixedJson += '{' + jsonObjects[i];
          } else {
            fixedJson += '{' + jsonObjects[i] + '}';
          }
        }
        fixedJson += ']';
        
        console.log('Fixed JSON:', fixedJson);
        json = JSON.parse(fixedJson);
      } else {
        throw e;
      }
    }
    
    // Handle array of responses
    if (Array.isArray(json)) {
      console.log('Received array of responses:', json);
      // Check if any response has an error
      for (var i = 0; i < json.length; i++) {
        if (json[i].status === "error") {
          console.log("API error:", json[i].msg);
          return [];
        }
      }
      // If no errors, return the data from the last response
      var lastResponse = json[json.length - 1];
      return lastResponse.data || [];
    }
    
    // Handle single response
    if (json.status === "error") {
      console.log("API error: " + json.msg);
      return [];
    }
    
    if (json.msg === "Token has been expired" || json.success === false) {
      console.log("API error: " + json.msg);
      return [];
    }
    
    console.log('Parsed JSON:', json);
    return json.data || [];
  } catch (e) {
    console.log("fetchFromAPI error: " + e.toString());
    console.log("Error details:", e.message);
    return [];
  }
}

/**
 * Login user with email and password
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @return {Object} Login result with user data if successful
 */
function loginUser(email, password) {
  try {
    if (!email || !password) {
      return {
        success: false,
        message: "Email and password are required"
      };
    }
    var requestTime = getCurrentRequestTime();
    var endpoint = "apis/getQueryData/?request_time=" + requestTime;
    var url = buildApiUrl(endpoint);
    var hashedPassword = hashPassword(password);
    var sqlQuery = "SELECT user_id, email, first_name, last_name, role, employee_id, current_status FROM users WHERE email = '" + email + "' AND password = '" + hashedPassword + "'";
    var xcode = generateXCode(endpoint);
    var options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        email: email,
        query: sqlQuery
      },
      headers: {
        "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
        "X-Code": xcode,
        "X-Request-Time": requestTime
      },
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    var json = JSON.parse(responseText);
    if (json.msg === "Token has been expired" || json.success === false) {
      return {
        success: false,
        message: json.msg || "Authentication failed"
      };
    }
    if (json.data && json.data.length > 0 && json.data[0].users) {
      var userData = json.data[0].users;
      try {
        var scriptProperties = PropertiesService.getScriptProperties();
        
        // Add logging to track login sessions
        console.log('=== LOGIN SESSION START ===');
        console.log('Logging in user:', userData.user_id, 'Email:', userData.email);
        console.log('Name:', (userData.first_name || '') + ' ' + (userData.last_name || ''));
        
        scriptProperties.deleteAllProperties();
        scriptProperties.setProperty('user_id', userData.user_id.toString());
        scriptProperties.setProperty('email', userData.email);
        scriptProperties.setProperty('first_name', userData.first_name || '');
        scriptProperties.setProperty('last_name', userData.last_name || '');
        scriptProperties.setProperty('userName', (userData.first_name || '') + ' ' + (userData.last_name || ''));
        scriptProperties.setProperty('role', userData.role || '');
        scriptProperties.setProperty('employee_id', userData.employee_id || '');
        scriptProperties.setProperty('current_status', userData.current_status || '0');
        scriptProperties.setProperty('last_login', new Date().getTime().toString());
        scriptProperties.setProperty('isLoggedIn', 'true');
        
        console.log('Login session properties set successfully');
        console.log('=== LOGIN SESSION END ===');
        
        return {
          success: true,
          user: userData
        };
      } catch (propError) {
        console.error('Failed to save login state:', propError);
        return {
          success: false,
          message: "Failed to save login state. Please try again."
        };
      }
    } else {
      return {
        success: false,
        message: "Invalid login credentials"
      };
    }
  } catch (e) {
    return {
      success: false,
      message: "Login failed: " + e.toString()
    };
  }
}

/**
 * Validates user login credentials (for compatibility with frontend)
 * This function is called from the client-side JavaScript
 * 
 * @param {string} email - The user's email address
 * @param {string} password - The user's password
 * @return {Object} Object with success status and user data if successful
 */
function checkLogin(email, password) {
  try {
    var loginResult = loginUser(email, password);
    console.log('Login result:', loginResult);
    
    if (loginResult.success && loginResult.user) {
      var user = loginResult.user;
      console.log('User data from API:', user);
      
      // Construct full name from first_name and last_name
      var fullName = '';
      if (user.first_name && user.last_name) {
        fullName = user.first_name + ' ' + user.last_name;
      } else if (user.first_name) {
        fullName = user.first_name;
      } else if (user.last_name) {
        fullName = user.last_name;
      } else {
        fullName = user.email; // Fallback to email if no name fields
      }
      
      var result = {
        success: true,
        user: {
          user_id: user.user_id,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          full_name: fullName,
          email: user.email,
          role: user.role || 'User',
          employee_id: user.employee_id || '',
          current_status: user.current_status || '0'
        }
      };
      
      console.log('Final result for frontend:', result);
      return result;
    }
    return { success: false };
  } catch (error) {
    console.error('Error in checkLogin:', error);
    return { success: false };
  }
}

/**
 * Create a new session for authenticated user
 * @param {number} userId - User ID
 * @param {string} email - User's email
 * @return {Object} Session data with token
 */
function createSession(userId, email) {
  var token = Utilities.getUuid();
  var sessionKey = 'session_' + token;
  var expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  var sessionData = {
    user_id: userId,
    email: email,
    expires: expiresAt.toISOString()
  };
  var props = PropertiesService.getScriptProperties();
  var active = JSON.parse(props.getProperty('active_sessions') || '[]');
  props.setProperty(sessionKey, JSON.stringify(sessionData));
  active.push(sessionKey);
  props.setProperty('active_sessions', JSON.stringify(active));
  return { token: token, expiresIn: 86400 };
}

/**
 * Authenticate a user with email and password
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @return {Object} Authentication result with token if successful
 */
function authenticateUser(email, password) {
  try {
    var login = loginUser(email, password);
    if (!login || !login.success || !login.user) {
      return { success: false, message: login && login.message ? login.message : 'Authentication failed' };
    }
    var user = login.user;
    var session = createSession(user.user_id, user.email);
    return {
      success: true,
      user_id: user.user_id,
      email: user.email,
      token: session.token,
      expiresIn: session.expiresIn
    };
  } catch (e) {
    return { success: false, message: 'Authentication error: ' + e.toString() };
  }
}

/**
 * Check if a session is valid
 * @param {string} token - Session token
 * @return {Object} Session validity check result
 */
function checkSession(token) {
  try {
    if (!token) return { valid: false };
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty('session_' + token);
    if (!raw) return { valid: false };
    var session = JSON.parse(raw);
    if (new Date(session.expires) < new Date()) {
      props.deleteProperty('session_' + token);
      return { valid: false };
    }
    return { valid: true, user_id: session.user_id, email: session.email };
  } catch (e) {
    return { valid: false };
  }
}

/**
 * Logout user by invalidating their session
 * @param {string} token - Session token
 * @return {Object} Logout result
 */
function logoutUser(token) {
  var props = PropertiesService.getScriptProperties();
  if (token) {
    var key = 'session_' + token;
    props.deleteProperty(key);
    var sessions = JSON.parse(props.getProperty('active_sessions') || '[]');
    var updated = sessions.filter(function(k) { return k !== key; });
    props.setProperty('active_sessions', JSON.stringify(updated));
  } else {
    // legacy fallback
    props.deleteAllProperties();
  }
  return { success: true };
}

/**
 * Hydrate session data into script properties for API calls
 * @param {string} token - Session token
 * @return {Object} Hydration result
 */
function hydrateSession(token) {
  try {
    if (!token) return { success: false, message: 'No token' };
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty('session_' + token);
    if (!raw) return { success: false, message: 'Invalid token' };
    var session = JSON.parse(raw);
    // Set properties required by existing data functions
    props.setProperty('user_id', String(session.user_id || ''));
    props.setProperty('email', String(session.email || ''));
    props.setProperty('isLoggedIn', 'true');
    props.setProperty('last_login', String(new Date().getTime()));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Helper function to escape SQL strings
 * Escapes single quotes, removes/replaces problematic characters
 * @param {string} str - String to escape
 * @return {string} Escaped string safe for SQL queries
 */
function sqlSafe(str) {
  if (str === null || str === undefined) return '';
  
  // Convert to string
  var safeStr = String(str);
  
  // Replace single quotes with double single quotes for SQL
  safeStr = safeStr.replace(/'/g, "''");
  
  // Replace problematic characters that might trigger security checks
  // Remove or replace emojis and special Unicode characters
  safeStr = safeStr.replace(/[\u{1F300}-\u{1F9FF}]/gu, ''); // Remove emojis
  safeStr = safeStr.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Remove misc symbols
  safeStr = safeStr.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Remove dingbats
  
  // CRITICAL: Replace newlines with spaces (API blocks \n even when escaped)
  safeStr = safeStr.replace(/\r\n/g, ' '); // Windows
  safeStr = safeStr.replace(/\n/g, ' ');   // Unix
  safeStr = safeStr.replace(/\r/g, ' ');   // Mac
  
  // Remove any null bytes or other control characters that might cause issues
  safeStr = safeStr.replace(/\0/g, '');
  
  // Remove tabs as they might also trigger security filters
  safeStr = safeStr.replace(/\t/g, ' ');
  
  return safeStr;
}


/**
 * Retrieves dashboard data with optional filtering
 * This function is called from the client-side JavaScript to populate the data table
 * 
 * @param {Object} filters - Filter object containing role, status, and department
 * @return {Array} Array of user records matching the filters
 */
function getDashboardData(filters) {
  try {
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in, returning empty data');
      return [];
    }
    
    // Build SQL query based on filters
    var baseQuery = "SELECT user_id, email, name, role, department, status, last_login FROM users";
    var whereConditions = [];
    
    // Add filters to query
    if (filters && filters.role) {
      whereConditions.push("role = '" + sqlSafe(filters.role) + "'");
    }
    if (filters && filters.status) {
      whereConditions.push("status = '" + sqlSafe(filters.status) + "'");
    }
    if (filters && filters.department) {
      whereConditions.push("department = '" + sqlSafe(filters.department) + "'");
    }
    
    // Add WHERE clause if filters exist
    if (whereConditions.length > 0) {
      baseQuery += " WHERE " + whereConditions.join(" AND ");
    }
    
    // Add ORDER BY clause
    baseQuery += " ORDER BY user_id ASC";
    
    console.log('Executing query:', baseQuery);
    
    // Fetch data from API
    var apiData = fetchFromAPI(baseQuery);
    
    if (!apiData || apiData.length === 0) {
      console.log('No data returned from API');
      return [];
    }
    
    // Transform API data to match frontend expectations
    var transformedData = [];
    for (var i = 0; i < apiData.length; i++) {
      var record = apiData[i];
      if (record.users) {
        var user = record.users;
        transformedData.push({
          id: user.user_id || (i + 1),
          name: user.name || 'Unknown User',
          email: user.email || '',
          role: user.role || 'User',
          department: user.department || 'General',
          status: user.status || 'Active',
          lastLogin: user.last_login || 'Never'
        });
      }
    }
    
    console.log('Transformed data:', transformedData.length, 'records');
    return transformedData;
    
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    return [];
  }
}

/**
 * Get JD count for a specific user
 * @param {string} userId - User ID to get JD count for
 * @return {Object} Result object with JD count
 */
function getJDCountForUser(userId) {
  try {
    console.log('=== GETTING JD COUNT FOR USER ===');
    console.log('Getting JD count for user:', userId);
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var currentUserId = props.getProperty('user_id');
    
    // Validate user context to prevent displaying wrong user's data
    if (!isLoggedIn || !currentUserId) {
      console.log('No user session found');
      return { success: false, message: 'No user session found' };
    }
    
    // CRITICAL: Verify the userId parameter matches the logged-in user
    if (userId !== currentUserId) {
      console.error('User ID mismatch! Requested:', userId, 'Logged in:', currentUserId);
      console.error('This indicates a race condition or stale session data');
      return { success: false, message: 'User context mismatch' };
    }
    
    console.log('User context verified. User ID:', userId, 'matches logged-in user:', currentUserId);
    
    // Get user's first and last name from properties
    var firstName = props.getProperty('first_name');
    var lastName = props.getProperty('last_name');
    var userName = props.getProperty('userName');
    
    console.log('User Name:', userName);
    console.log('First Name:', firstName);
    console.log('Last Name:', lastName);
    
    // Get user data from database to ensure we have the correct names
    var userQuery = `SELECT first_name, last_name FROM users WHERE user_id = '${sqlSafe(userId)}'`;
    console.log('User data query:', userQuery);
    
    var userResult = fetchFromAPI(userQuery);
    var actualFirstName = '';
    var actualLastName = '';
    var actualFullName = '';
    
    console.log('Checking userResult:', userResult);
    console.log('userResult.status:', userResult ? userResult.status : 'undefined');
    console.log('userResult.data:', userResult ? userResult.data : 'undefined');
    console.log('userResult.data.length:', userResult && userResult.data ? userResult.data.length : 'undefined');
    
    // Handle both response formats: full object or direct data array
    var userDataArray = null;
    if (userResult && userResult.status === 'success' && userResult.data && userResult.data.length > 0) {
      userDataArray = userResult.data;
      console.log('Using full response object format');
    } else if (userResult && Array.isArray(userResult) && userResult.length > 0) {
      userDataArray = userResult;
      console.log('Using direct data array format');
    }
    
    if (userDataArray && userDataArray.length > 0) {
      var userData = userDataArray[0].users;
      actualFirstName = userData.first_name || '';
      actualLastName = userData.last_name || '';
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      
      console.log('Retrieved user data from DB - FirstName:', actualFirstName, 'LastName:', actualLastName, 'FullName:', actualFullName);
    } else {
      console.log('Could not retrieve user data from DB, using stored values');
      actualFirstName = firstName || '';
      actualLastName = lastName || '';
      actualFullName = userName || '';
    }
    
    // Ensure we have the full name constructed properly
    if (!actualFullName || actualFullName.trim() === '') {
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      console.log('Constructed full name from parts:', actualFullName);
    }
    
    // Build the WHERE clause based on available user data
    var whereConditions = [];
    
    // Add conditions for full name only
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
      console.log('Added full name conditions for:', actualFullName);
    } else if (actualFirstName && actualFirstName.trim() !== '') {
      // Fallback to first name if full name is not available
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFirstName)}%'`);
      console.log('Added first name conditions for:', actualFirstName);
    }
    
    // Only proceed if we have name conditions
    if (whereConditions.length === 0) {
      console.log('No name available, returning empty result');
      return { success: true, data: { jdCount: 0 }, message: 'No name available for search' };
    } else {
      console.log('Using name-based search with', whereConditions.length, 'conditions');
    }
    
    var whereClause = whereConditions.join(' OR ');
    
    // Query to get JD count for the current user
    var sqlQuery = `
      SELECT COUNT(*) as jd_count
      FROM bi_t14s 
      WHERE (${whereClause})
      AND requirement_status = 'Open'
    `;
    
    console.log('JD count query:', sqlQuery);
    
    var result = fetchFromAPI(sqlQuery);
    
    console.log('Checking result:', result);
    console.log('result.status:', result ? result.status : 'undefined');
    console.log('result.data:', result ? result.data : 'undefined');
    
    // Handle both response formats: full object or direct data array
    var jdCount = 0;
    if (result && result.status === 'success' && result.data && result.data.length > 0) {
      // Handle nested array structure: [[{"jd_count":"3"}]]
      if (result.data[0] && Array.isArray(result.data[0]) && result.data[0].length > 0) {
        jdCount = parseInt(result.data[0][0].jd_count) || 0;
        console.log('Using nested array format for JD count');
      } else if (result.data[0] && result.data[0].jd_count) {
        jdCount = parseInt(result.data[0].jd_count) || 0;
        console.log('Using direct object format for JD count');
      }
    } else if (result && Array.isArray(result) && result.length > 0) {
      // Handle direct data array format
      if (result[0] && Array.isArray(result[0]) && result[0].length > 0) {
        jdCount = parseInt(result[0][0].jd_count) || 0;
        console.log('Using direct array format for JD count');
      } else if (result[0] && result[0].jd_count) {
        jdCount = parseInt(result[0].jd_count) || 0;
        console.log('Using direct object format for JD count');
      }
    }
    
    console.log('JD count for user', userId, ':', jdCount);
    
    return {
      success: true,
      data: { jdCount: jdCount },
      message: 'Found ' + jdCount + ' JDs for user'
    };
    
  } catch (error) {
    console.error('Error getting JD count for user:', error);
    return { success: false, data: { jdCount: 0 }, message: 'Error retrieving JD count' };
  }
}

/**
 * Get job titles from JDs assigned to the currently logged-in user
 * @return {Object} Result object with success status and job titles data
 */
function getUserAssignedJobTitles() {
  try {
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var firstName = props.getProperty('firstName');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in, returning empty job titles');
      return { success: false, data: [], message: 'User not logged in' };
    }
    
    console.log('Getting job titles for user:', userId, 'Name:', userName, 'FirstName:', firstName);
    
    // Get user data from database to ensure we have the correct names
    var userQuery = `SELECT first_name, last_name FROM users WHERE user_id = '${sqlSafe(userId)}'`;
    console.log('User data query:', userQuery);
    
    var userResult = fetchFromAPI(userQuery);
    var actualFirstName = '';
    var actualLastName = '';
    var actualFullName = '';
    
    console.log('Checking userResult:', userResult);
    console.log('userResult.status:', userResult ? userResult.status : 'undefined');
    console.log('userResult.data:', userResult ? userResult.data : 'undefined');
    console.log('userResult.data.length:', userResult && userResult.data ? userResult.data.length : 'undefined');
    
    // Handle both response formats: full object or direct data array
    var userDataArray = null;
    if (userResult && userResult.status === 'success' && userResult.data && userResult.data.length > 0) {
      userDataArray = userResult.data;
      console.log('Using full response object format');
    } else if (userResult && Array.isArray(userResult) && userResult.length > 0) {
      userDataArray = userResult;
      console.log('Using direct data array format');
    }
    
    if (userDataArray && userDataArray.length > 0) {
      var userData = userDataArray[0].users;
      actualFirstName = userData.first_name || '';
      actualLastName = userData.last_name || '';
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      
      console.log('Retrieved user data from DB - FirstName:', actualFirstName, 'LastName:', actualLastName, 'FullName:', actualFullName);
    } else {
      console.log('Could not retrieve user data from DB, using stored values');
      actualFirstName = firstName || '';
      actualLastName = props.getProperty('last_name') || '';
      actualFullName = userName || '';
    }
    
    // Ensure we have the full name constructed properly
    if (!actualFullName || actualFullName.trim() === '') {
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      console.log('Constructed full name from parts:', actualFullName);
    }
    
    // Build the WHERE clause based on available user data
    var whereConditions = [];
    
    // Add conditions for full name only
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
      console.log('Added full name conditions for:', actualFullName);
    } else if (actualFirstName && actualFirstName.trim() !== '') {
      // Fallback to first name if full name is not available
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFirstName)}%'`);
      console.log('Added first name conditions for:', actualFirstName);
    }
    
    
    // Only proceed if we have full name conditions
    if (whereConditions.length === 0) {
      console.log('No full name available, returning empty result');
      return { success: true, data: [], message: 'No full name available for search' };
    } else {
      console.log('Using full name-based search with', whereConditions.length, 'conditions');
    }
    
    var whereClause = whereConditions.join(' OR ');
    
    // Query to get job titles from JDs assigned to the current user
    var sqlQuery = `
      SELECT requirement_name as job_title
      FROM bi_t14s 
      WHERE (${whereClause})
      AND requirement_status = 'Open'
      AND requirement_name IS NOT NULL
      AND requirement_name != ''
      ORDER BY requirement_name ASC
    `;
    
    console.log('Job titles query:', sqlQuery);
    
    var result = fetchFromAPI(sqlQuery);
    
    console.log('Checking result:', result);
    console.log('result.status:', result ? result.status : 'undefined');
    console.log('result.data:', result ? result.data : 'undefined');
    
    // Handle both response formats: full object or direct data array
    var jobTitles = [];
    if (result && result.status === 'success' && result.data && result.data.length > 0) {
      console.log('Using full response object format for job titles');
      result.data.forEach(function(item) {
        var jobData = item.bi_t14s || item;
        if (jobData && jobData.job_title) {
          jobTitles.push(jobData.job_title);
        }
      });
    } else if (result && Array.isArray(result) && result.length > 0) {
      console.log('Using direct data array format for job titles');
      result.forEach(function(item) {
        var jobData = item.bi_t14s || item;
        if (jobData && jobData.job_title) {
          jobTitles.push(jobData.job_title);
        }
      });
    }
    
    console.log('Found job titles:', jobTitles);
    
    return {
      success: true,
      data: jobTitles,
      message: 'Found ' + jobTitles.length + ' job titles for user'
    };
    
  } catch (error) {
    console.error('Error getting job titles for user:', error);
    return { success: false, data: [], message: 'Error retrieving job titles' };
  }
}

/**
 * Get user's assigned JD IDs
 * @return {Array} Array of JD IDs assigned to the current user
 */
function getUserAssignedJDIds() {
  try {
    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var firstName = props.getProperty('firstName');
    
    // Get user data from database
    var userQuery = `SELECT first_name, last_name FROM users WHERE user_id = '${sqlSafe(userId)}'`;
    var userResult = fetchFromAPI(userQuery);
    
    var actualFirstName = '';
    var actualLastName = '';
    var actualFullName = '';
    
    // Handle both response formats
    var userDataArray = null;
    if (userResult && userResult.status === 'success' && userResult.data && userResult.data.length > 0) {
      userDataArray = userResult.data;
    } else if (userResult && Array.isArray(userResult) && userResult.length > 0) {
      userDataArray = userResult;
    }
    
    if (userDataArray && userDataArray.length > 0) {
      var userData = userDataArray[0].users;
      actualFirstName = userData.first_name || '';
      actualLastName = userData.last_name || '';
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
    } else {
      actualFirstName = firstName || '';
      actualLastName = props.getProperty('last_name') || '';
      actualFullName = userName || '';
    }
    
    if (!actualFullName || actualFullName.trim() === '') {
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
    }
    
    // Build WHERE clause
    var whereConditions = [];
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
    } else if (actualFirstName && actualFirstName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFirstName)}%'`);
    }
    
    if (whereConditions.length === 0) {
      return [];
    }
    
    var whereClause = whereConditions.join(' OR ');
    var jdQuery = `SELECT bi_primary_id as jd_id FROM bi_t14s WHERE (${whereClause}) AND requirement_status = 'Open'`;
    
    var jdResult = fetchFromAPI(jdQuery);
    var jdIds = [];
    
    if (jdResult && Array.isArray(jdResult) && jdResult.length > 0) {
      jdResult.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
        }
      });
    } else if (jdResult && jdResult.status === 'success' && jdResult.data && jdResult.data.length > 0) {
      jdResult.data.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
        }
      });
    }
    
    return jdIds;
  } catch (error) {
    console.error('Error getting user assigned JD IDs:', error);
    return [];
  }
}

/**
 * Get recent candidates for home page with pagination
 * @param {number} limit - Number of recent candidates to return
 * @return {Object} Recent candidates data
 */
function getRecentCandidates(limit) {
  try {
    // Ensure limit is a valid number
    limit = limit || 5;
    console.log('Getting recent candidates from bi_t31s, limit:', limit);
    
    // Get user's assigned JDs first
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in, returning empty recent candidates');
      return { success: true, data: [] };
    }
    
    // Get user's assigned JD IDs
    var jdIds = getUserAssignedJDIds();
    if (jdIds.length === 0) {
      console.log('No JDs assigned to user, returning empty recent candidates');
      return { success: true, data: [] };
    }
    
    console.log('Found JDs for recent candidates:', jdIds);
    
    // Query to get the most recent candidates from user's assigned JDs only
    var sqlQuery = `
      SELECT 
        bi_primary_id,
        candidate_name,
        requirement_name,
        current_role,
        current_company,
        email,
        total_experience,
        contact_number,
        notice_period,
        current_location,
        preferred_locations,
        education,
        current_ctc,
        source,
        match_percentage,
        selection_percentage,
        reasoning,
        status,
        resume,
        spoc
      FROM bi_t31s 
      WHERE job_id IN ('${jdIds.join("','")}')
      ORDER BY bi_primary_id DESC 
      LIMIT 0, ${limit}
    `;
    
    console.log('Recent candidates query:', sqlQuery);
    
    // Execute the query
    var result = fetchFromAPI(sqlQuery);
    console.log('Recent candidates API result:', result);
    
    if (result && result.length > 0) {
      // Transform the data to match the frontend format
      var recentCandidates = result.map(function(candidate, index) {
        var candidateData = candidate.bi_t31s || candidate;
        var coalesceData = candidate['0'] || {};
        var mergedData = Object.assign({}, candidateData, coalesceData);
        
        return {
          id: mergedData.bi_primary_id || (index + 1),
          name: mergedData.candidate_name || 'Unknown',
          requirementName: mergedData.requirement_name || 'Not specified',
          currentRole: mergedData.current_role || 'Not specified',
          currentCompany: mergedData.current_company || 'Not specified',
          email: mergedData.email || 'No email',
          totalExperience: mergedData.total_experience || 'Not specified',
          contactNumber: mergedData.contact_number || 'Not specified',
          noticePeriod: mergedData.notice_period || 'Not specified',
          currentLocation: mergedData.current_location || 'Not specified',
          preferredLocation: mergedData.preferred_locations || 'Not specified',
          education: mergedData.education || 'Not specified',
          currentCtc: mergedData.current_ctc || 'Not specified',
          source: mergedData.source || 'Not specified',
          matchPercentage: mergedData.match_percentage || 'Not specified',
          selectionPercentage: mergedData.selection_percentage || 'Not specified',
          reasoning: mergedData.reasoning || 'Not specified',
          status: mapCandidateStatus(mergedData.status),
          resumeUrl: mergedData.resume || null,
          spoc: mergedData.spoc || 'Not assigned'
        };
      });
      
      console.log('Transformed recent candidates:', recentCandidates);
      return {
        success: true,
        data: recentCandidates
      };
    } else {
      console.log('No recent candidates found');
      return {
        success: true,
        data: []
      };
    }
  } catch (error) {
    console.error('Error getting recent candidates:', error);
    return {
      success: false,
      data: [],
      message: 'Error retrieving recent candidates'
    };
  }
}

/**
 * Map database status to frontend status
 * @param {string} dbStatus - Database status value
 * @return {string} Frontend status value
 */
function mapCandidateStatus(dbStatus) {
  // Handle null, empty, or undefined status as Pending
  if (!dbStatus || dbStatus === null || dbStatus === '' || dbStatus === 'null') {
    return 'Pending';
  }
  
  // Map database status to frontend status
  switch (dbStatus) {
    case 'Shortlisted':
      return 'Shortlisted';
    case 'Replied':
      return 'Replied';
    case 'Booked':
      return 'Booked';
    case 'No-show':
      return 'No-show';
    case 'No_show':  // Handle underscore version from database
      return 'No-show';
    case 'Disqualified':
      return 'Disqualified';
    case 'Pending':
      return 'Pending';
    default:
      return 'Pending'; // Default to Pending for unknown statuses
  }
}

/**
 * Get home page statistics
 * @return {Object} Home page stats data
 */
function getHomePageStats() {
  try {
    console.log('=== GETTING HOME PAGE STATS ===');
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var lastLogin = props.getProperty('last_login');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in, returning empty stats');
      return { success: false, message: 'User not logged in' };
    }
    
    console.log('Getting home page stats for user:', userId);
    console.log('User name:', userName);
    console.log('Last login timestamp:', lastLogin);
    
    // Get JD count for user
    var jdCountResult = getJDCountForUser(userId);
    var jdCount = 0;
    if (jdCountResult && jdCountResult.success) {
      jdCount = jdCountResult.data.jdCount || 0;
    } else {
      console.error('Failed to get JD count:', jdCountResult);
    }
    
    // Get candidate count for user
    var candidateCountResult = getCandidateCountForUser();
    var candidateCount = 0;
    if (candidateCountResult && candidateCountResult.success) {
      candidateCount = candidateCountResult.data || 0;
    } else {
      console.error('Failed to get candidate count:', candidateCountResult);
    }
    
    // Get JD statistics for user
    var jdStatsResult = getJDStatisticsForUser();
    var jdStatistics = [];
    if (jdStatsResult && jdStatsResult.success) {
      jdStatistics = jdStatsResult.data || [];
    }
    
    var stats = {
      jdCount: jdCount,
      candidateCount: candidateCount,
      jdStatistics: jdStatistics
    };
    
    console.log('Home page stats for user', userId, ':', stats);
    console.log('=== END GETTING HOME PAGE STATS ===');
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('Error getting home page stats:', error);
    return {
      success: false,
      message: 'Failed to get statistics: ' + error.toString()
    };
  }
}

/**
 * Get candidate count for the currently logged-in user
 * @return {Object} Result object with candidate count
 */
function getCandidateCountForUser() {
  try {
    console.log('=== GETTING CANDIDATE COUNT FOR USER ===');
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userEmail = props.getProperty('email');
    var userName = props.getProperty('userName');
    var lastLogin = props.getProperty('last_login');
    
    if (!isLoggedIn || !userId) {
      console.log('No user session found');
      return { success: false, message: 'No user session found' };
    }
    
    console.log('Getting candidate count for user:', userId);
    console.log('User email:', userEmail);
    console.log('User name:', userName);
    console.log('Last login timestamp:', lastLogin);
    
    // Get user's first and last name from database
    var userQuery = `SELECT first_name, last_name FROM users WHERE user_id = '${sqlSafe(userId)}'`;
    console.log('User data query:', userQuery);
    
    var userResult = fetchFromAPI(userQuery);
    var actualFirstName = '';
    var actualLastName = '';
    var actualFullName = '';
    
    // Handle both response formats: full object or direct data array
    var userDataArray = null;
    if (userResult && userResult.status === 'success' && userResult.data && userResult.data.length > 0) {
      userDataArray = userResult.data;
    } else if (userResult && Array.isArray(userResult) && userResult.length > 0) {
      userDataArray = userResult;
    }
    
    if (userDataArray && userDataArray.length > 0) {
      var userData = userDataArray[0].users;
      actualFirstName = userData.first_name || '';
      actualLastName = userData.last_name || '';
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      
      console.log('Retrieved user data from DB - FirstName:', actualFirstName, 'LastName:', actualLastName, 'FullName:', actualFullName);
    } else {
      console.log('Could not retrieve user data from DB, using stored values');
      actualFirstName = props.getProperty('first_name') || '';
      actualLastName = props.getProperty('last_name') || '';
      actualFullName = props.getProperty('userName') || '';
    }
    
    // Ensure we have the full name constructed properly
    if (!actualFullName || actualFullName.trim() === '') {
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      console.log('Constructed full name from parts:', actualFullName);
    }
    
    // Build the WHERE clause based on available user data
    var whereConditions = [];
    
    // Add conditions for full name only
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
      console.log('Added full name conditions for:', actualFullName);
    } else if (actualFirstName && actualFirstName.trim() !== '') {
      // Fallback to first name if full name is not available
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFirstName)}%'`);
      console.log('Added first name conditions for:', actualFirstName);
    }
    
    // Only proceed if we have name conditions
    if (whereConditions.length === 0) {
      console.log('No name available, returning empty result');
      return { success: true, data: 0, message: 'No name available for search' };
    } else {
      console.log('Using name-based search with', whereConditions.length, 'conditions');
    }
    
    var whereClause = whereConditions.join(' OR ');
    
    // First, get JD IDs assigned to the user
    var jdQuery = `SELECT bi_primary_id as jd_id FROM bi_t14s WHERE (${whereClause}) AND requirement_status = 'Open'`;
    console.log('JD query:', jdQuery);
    
    var jdResult = fetchFromAPI(jdQuery);
    var jdIds = [];
    
    if (jdResult && Array.isArray(jdResult) && jdResult.length > 0) {
      jdResult.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
        }
      });
    } else if (jdResult && jdResult.status === 'success' && jdResult.data && jdResult.data.length > 0) {
      jdResult.data.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
        }
      });
    }
    
    console.log('Found JDs for user:', jdIds);
    
    if (jdIds.length === 0) {
      console.log('No JDs assigned to user, returning 0 candidates');
      return { success: true, data: 0, message: 'No JDs assigned to user' };
    }
    
    // Count candidates for these JDs
    var candidateCountQuery = `SELECT COUNT(DISTINCT bi_primary_id) as candidate_count FROM bi_t31s WHERE job_id IN ('${jdIds.join("','")}')`;
    console.log('Candidate count query:', candidateCountQuery);
    
    var candidateResult = fetchFromAPI(candidateCountQuery);
    var candidateCount = 0;
    
    if (candidateResult && Array.isArray(candidateResult) && candidateResult.length > 0) {
      // Handle nested array structure: [[{"candidate_count":"10"}]]
      if (candidateResult[0] && Array.isArray(candidateResult[0]) && candidateResult[0].length > 0) {
        candidateCount = parseInt(candidateResult[0][0].candidate_count) || 0;
        console.log('Using nested array format for candidate count');
      } else if (candidateResult[0] && candidateResult[0].candidate_count) {
        candidateCount = parseInt(candidateResult[0].candidate_count) || 0;
        console.log('Using direct object format for candidate count');
      }
    } else if (candidateResult && candidateResult.status === 'success' && candidateResult.data && candidateResult.data.length > 0) {
      // Handle full response object format
      if (candidateResult.data[0] && Array.isArray(candidateResult.data[0]) && candidateResult.data[0].length > 0) {
        candidateCount = parseInt(candidateResult.data[0][0].candidate_count) || 0;
        console.log('Using full response nested array format for candidate count');
      } else if (candidateResult.data[0] && candidateResult.data[0].candidate_count) {
        candidateCount = parseInt(candidateResult.data[0].candidate_count) || 0;
        console.log('Using full response direct object format for candidate count');
      }
    }
    
    console.log('Candidate count for user', userId, ':', candidateCount);
    
    return {
      success: true,
      data: candidateCount,
      message: 'Found ' + candidateCount + ' candidates for user'
    };
    
  } catch (error) {
    console.error('Error getting candidate count for user:', error);
    return { success: false, data: 0, message: 'Error retrieving candidate count' };
  }
}

/**
 * Get JD statistics for the currently logged-in user
 * @return {Object} Result object with JD statistics data
 */
function getJDStatisticsForUser() {
  try {
    console.log('=== GETTING JD STATISTICS FOR USER ===');
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('No user session found');
      return { success: false, message: 'No user session found' };
    }
    
    console.log('Getting JD statistics for user:', userId);
    
    // Get user's first and last name from database
    var userQuery = `SELECT first_name, last_name FROM users WHERE user_id = '${sqlSafe(userId)}'`;
    console.log('User data query:', userQuery);
    
    var userResult = fetchFromAPI(userQuery);
    var actualFirstName = '';
    var actualLastName = '';
    var actualFullName = '';
    
    // Handle both response formats: full object or direct data array
    var userDataArray = null;
    if (userResult && userResult.status === 'success' && userResult.data && userResult.data.length > 0) {
      userDataArray = userResult.data;
    } else if (userResult && Array.isArray(userResult) && userResult.length > 0) {
      userDataArray = userResult;
    }
    
    if (userDataArray && userDataArray.length > 0) {
      var userData = userDataArray[0].users;
      actualFirstName = userData.first_name || '';
      actualLastName = userData.last_name || '';
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      
      console.log('Retrieved user data from DB - FirstName:', actualFirstName, 'LastName:', actualLastName, 'FullName:', actualFullName);
    } else {
      console.log('Could not retrieve user data from DB, using stored values');
      actualFirstName = props.getProperty('first_name') || '';
      actualLastName = props.getProperty('last_name') || '';
      actualFullName = props.getProperty('userName') || '';
    }
    
    // Ensure we have the full name constructed properly
    if (!actualFullName || actualFullName.trim() === '') {
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      console.log('Constructed full name from parts:', actualFullName);
    }
    
    // Build the WHERE clause based on available user data
    var whereConditions = [];
    
    // Add conditions for full name only
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
      console.log('Added full name conditions for:', actualFullName);
    } else if (actualFirstName && actualFirstName.trim() !== '') {
      // Fallback to first name if full name is not available
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFirstName)}%'`);
      console.log('Added first name conditions for:', actualFirstName);
    }
    
    // Only proceed if we have name conditions
    if (whereConditions.length === 0) {
      console.log('No name available, returning empty result');
      return { success: true, data: [], message: 'No name available for search' };
    } else {
      console.log('Using name-based search with', whereConditions.length, 'conditions');
    }
    
    var whereClause = whereConditions.join(' OR ');
    
    // First, get JDs assigned to the user
    var jdQuery = `SELECT bi_primary_id, requirement_name FROM bi_t14s WHERE (${whereClause}) AND requirement_status = 'Open'`;
    console.log('JD query:', jdQuery);
    
    var jdResult = fetchFromAPI(jdQuery);
    var jdData = [];
    
    if (jdResult && Array.isArray(jdResult) && jdResult.length > 0) {
      jdResult.forEach(function(item) {
        var jd = item.bi_t14s || item;
        if (jd && jd.bi_primary_id && jd.requirement_name) {
          jdData.push({
            jdId: jd.bi_primary_id,
            jobTitle: jd.requirement_name
          });
        }
      });
    } else if (jdResult && jdResult.status === 'success' && jdResult.data && jdResult.data.length > 0) {
      jdResult.data.forEach(function(item) {
        var jd = item.bi_t14s || item;
        if (jd && jd.bi_primary_id && jd.requirement_name) {
          jdData.push({
            jdId: jd.bi_primary_id,
            jobTitle: jd.requirement_name
          });
        }
      });
    }
    
    console.log('Found JDs for user:', jdData);
    
    if (jdData.length === 0) {
      console.log('No JDs assigned to user, returning empty statistics');
      return { success: true, data: [], message: 'No JDs assigned to user' };
    }
    
    // Get statistics for each JD
    var jdStatistics = [];
    for (var i = 0; i < jdData.length; i++) {
      var jd = jdData[i];
      var jdId = jd.jdId;
      var jobTitle = jd.jobTitle;
      
      // Count total candidates for this JD
      var totalCandidatesQuery = `SELECT COUNT(*) as total_candidates FROM bi_t31s WHERE job_id = '${jdId}'`;
      var totalCandidatesResult = fetchFromAPI(totalCandidatesQuery);
      var totalCandidates = 0;
      
      if (totalCandidatesResult && Array.isArray(totalCandidatesResult) && totalCandidatesResult.length > 0) {
        if (totalCandidatesResult[0] && Array.isArray(totalCandidatesResult[0]) && totalCandidatesResult[0].length > 0) {
          totalCandidates = parseInt(totalCandidatesResult[0][0].total_candidates) || 0;
        } else if (totalCandidatesResult[0] && totalCandidatesResult[0].total_candidates) {
          totalCandidates = parseInt(totalCandidatesResult[0].total_candidates) || 0;
        }
      } else if (totalCandidatesResult && totalCandidatesResult.status === 'success' && totalCandidatesResult.data && totalCandidatesResult.data.length > 0) {
        if (totalCandidatesResult.data[0] && Array.isArray(totalCandidatesResult.data[0]) && totalCandidatesResult.data[0].length > 0) {
          totalCandidates = parseInt(totalCandidatesResult.data[0][0].total_candidates) || 0;
        } else if (totalCandidatesResult.data[0] && totalCandidatesResult.data[0].total_candidates) {
          totalCandidates = parseInt(totalCandidatesResult.data[0].total_candidates) || 0;
        }
      }
      
      // Count shortlisted candidates for this JD
      var shortlistedQuery = `SELECT COUNT(*) as shortlisted FROM bi_t31s WHERE job_id = '${jdId}' AND status = 'Shortlisted'`;
      var shortlistedResult = fetchFromAPI(shortlistedQuery);
      var shortlisted = 0;
      
      if (shortlistedResult && Array.isArray(shortlistedResult) && shortlistedResult.length > 0) {
        if (shortlistedResult[0] && Array.isArray(shortlistedResult[0]) && shortlistedResult[0].length > 0) {
          shortlisted = parseInt(shortlistedResult[0][0].shortlisted) || 0;
        } else if (shortlistedResult[0] && shortlistedResult[0].shortlisted) {
          shortlisted = parseInt(shortlistedResult[0].shortlisted) || 0;
        }
      } else if (shortlistedResult && shortlistedResult.status === 'success' && shortlistedResult.data && shortlistedResult.data.length > 0) {
        if (shortlistedResult.data[0] && Array.isArray(shortlistedResult.data[0]) && shortlistedResult.data[0].length > 0) {
          shortlisted = parseInt(shortlistedResult.data[0][0].shortlisted) || 0;
        } else if (shortlistedResult.data[0] && shortlistedResult.data[0].shortlisted) {
          shortlisted = parseInt(shortlistedResult.data[0].shortlisted) || 0;
        }
      }
      
      jdStatistics.push({
        jdId: jdId,
        jobTitle: jobTitle,
        totalCandidates: totalCandidates,
        shortlistedCandidates: shortlisted
      });
    }
    
    console.log('JD statistics for user', userId, ':', jdStatistics);
    
    return {
      success: true,
      data: jdStatistics,
      message: 'Found ' + jdStatistics.length + ' JD statistics for user'
    };
    
  } catch (error) {
    console.error('Error getting JD statistics for user:', error);
    return { success: false, data: [], message: 'Error retrieving JD statistics' };
  }
}

/**
 * Get user assigned candidates with pagination
 * @param {Object} filters - Filter object containing jobTitle, status, and pagination
 * @return {Object} Result object with candidates data and pagination info
 */
function getUserAssignedCandidates(filters) {
  try {
    console.log('=== GETTING USER ASSIGNED CANDIDATES WITH PAGINATION ===');
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var firstName = props.getProperty('firstName');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in, returning empty candidates');
      return { success: false, data: [], message: 'User not logged in' };
    }
    
    console.log('Getting candidates for user:', userId, 'Name:', userName, 'FirstName:', firstName);
    
    // Get user data from database to ensure we have the correct names
    var userQuery = `SELECT first_name, last_name FROM users WHERE user_id = '${sqlSafe(userId)}'`;
    console.log('User data query:', userQuery);
    
    var userResult = fetchFromAPI(userQuery);
    var actualFirstName = '';
    var actualLastName = '';
    var actualFullName = '';
    
    console.log('Checking userResult:', userResult);
    console.log('userResult.status:', userResult ? userResult.status : 'undefined');
    console.log('userResult.data:', userResult ? userResult.data : 'undefined');
    console.log('userResult.data.length:', userResult && userResult.data ? userResult.data.length : 'undefined');
    
    // Handle both response formats: full object or direct data array
    var userDataArray = null;
    if (userResult && userResult.status === 'success' && userResult.data && userResult.data.length > 0) {
      userDataArray = userResult.data;
      console.log('Using full response object format');
    } else if (userResult && Array.isArray(userResult) && userResult.length > 0) {
      userDataArray = userResult;
      console.log('Using direct data array format');
    }
    
    if (userDataArray && userDataArray.length > 0) {
      var userData = userDataArray[0].users;
      actualFirstName = userData.first_name || '';
      actualLastName = userData.last_name || '';
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      
      console.log('Retrieved user data from DB - FirstName:', actualFirstName, 'LastName:', actualLastName, 'FullName:', actualFullName);
    } else {
      console.log('Could not retrieve user data from DB, using stored values');
      actualFirstName = firstName || '';
      actualLastName = props.getProperty('last_name') || '';
      actualFullName = userName || '';
    }
    
    // Ensure we have the full name constructed properly
    if (!actualFullName || actualFullName.trim() === '') {
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      console.log('Constructed full name from parts:', actualFullName);
    }
    
    // Build the WHERE clause based on available user data
    var whereConditions = [];
    
    // Add conditions for full name only
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
      console.log('Added full name conditions for:', actualFullName);
    } else if (actualFirstName && actualFirstName.trim() !== '') {
      // Fallback to first name if full name is not available
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFirstName)}%'`);
      console.log('Added first name conditions for:', actualFirstName);
    }
    
    // Only proceed if we have name conditions
    if (whereConditions.length === 0) {
      console.log('No name available, returning empty result');
      return { success: true, data: [], message: 'No name available for search' };
    } else {
      console.log('Using name-based search with', whereConditions.length, 'conditions');
    }
    
    var whereClause = whereConditions.join(' OR ');
    
    // First, get JD IDs assigned to the user
    var jdQuery = `SELECT bi_primary_id as jd_id, requirement_name FROM bi_t14s WHERE (${whereClause}) AND requirement_status = 'Open'`;
    console.log('JD query:', jdQuery);
    
    var jdResult = fetchFromAPI(jdQuery);
    var jdIds = [];
    var jdJobTitles = {};
    
    if (jdResult && Array.isArray(jdResult) && jdResult.length > 0) {
      jdResult.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
          jdJobTitles[jdData.jd_id] = jdData.requirement_name || 'Unknown';
        }
      });
    } else if (jdResult && jdResult.status === 'success' && jdResult.data && jdResult.data.length > 0) {
      jdResult.data.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
          jdJobTitles[jdData.jd_id] = jdData.requirement_name || 'Unknown';
        }
      });
    }
    
    console.log('Found JDs for user:', jdIds);
    console.log('JD Job Titles:', jdJobTitles);
    console.log('JD Job Titles mapping:');
    for (var jdId in jdJobTitles) {
      console.log('  JD', jdId, '->', jdJobTitles[jdId]);
    }
    
    if (jdIds.length === 0) {
      console.log('No JDs assigned to user, returning empty candidates');
      return { success: true, data: [], message: 'No JDs assigned to user' };
    }
    
    // Restrict to only JDs matching the selected job title filter
    if (filters && filters.jobTitle && filters.jobTitle !== '') {
      var filteredJdIds = [];
      var filteredJdJobTitles = {};
      for (var jdId in jdJobTitles) {
        if (jdJobTitles[jdId] === filters.jobTitle) {
          filteredJdIds.push(jdId);
          filteredJdJobTitles[jdId] = jdJobTitles[jdId];
        }
      }
      console.log('Filtered JD IDs for job title', filters.jobTitle, ':', filteredJdIds);
      jdIds = filteredJdIds;
      jdJobTitles = filteredJdJobTitles;
    }
    
    // Get pagination parameters
    var page = parseInt(filters && filters.page ? filters.page : 1);
    var pageSize = 5; // Fixed page size as requested
    var start = (page - 1) * pageSize;
    
    console.log('Pagination - Page:', page, 'Page Size:', pageSize, 'Start:', start);
    
    // Build paginated candidates query
    var candidatesQuery = buildPaginatedCandidatesQuery(jdIds, jdJobTitles, filters, start, pageSize);
    console.log('Paginated candidates query:', candidatesQuery);
    
    // Execute the paginated query
    var candidatesResult = fetchFromAPI(candidatesQuery);
    
    if (candidatesResult && candidatesResult.length > 0) {
      console.log('Paginated query successful - found', candidatesResult.length, 'candidates');
      var candidates = processCandidatesFromResult(candidatesResult, jdJobTitles);
      
      // Get total count for pagination info with same filters
      var totalCountQuery = buildTotalCountQuery(jdIds, jdJobTitles, filters);
      console.log('Total count query:', totalCountQuery);
      var totalCountResult = fetchFromAPI(totalCountQuery);
      var totalCount = 0;
      
      if (totalCountResult && Array.isArray(totalCountResult) && totalCountResult[0] && Array.isArray(totalCountResult[0]) && totalCountResult[0][0] && totalCountResult[0][0].total) {
        totalCount = parseInt(totalCountResult[0][0].total, 10);
      }
      
      var totalPages = Math.ceil(totalCount / pageSize);
      
      return {
        success: true,
        data: candidates,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalCount: totalCount,
          totalPages: totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        message: 'Candidates retrieved successfully with pagination'
      };
    } else {
      console.log('No candidates found for current page');
      return {
        success: true,
        data: [],
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        },
        message: 'No candidates found for current page'
      };
    }
  } catch (error) {
    console.error('Error getting user assigned candidates:', error);
    return { success: false, data: [], message: 'Error retrieving candidates' };
  }
}

/**
 * Build paginated candidates query based on JD IDs and filters
 * @param {Array} jdIds - Array of JD IDs
 * @param {Object} jdJobTitles - Object mapping JD IDs to job titles
 * @param {Object} filters - Filter object containing jobTitle and status
 * @param {number} start - Starting offset for pagination
 * @param {number} pageSize - Number of records per page
 * @return {string} SQL query string
 */
function buildPaginatedCandidatesQuery(jdIds, jdJobTitles, filters, start, pageSize) {
  // Special handling for JD 784 - exclude reasoning column due to API issues
  var reasoningColumn = jdIds.includes('784') ? '' : 'COALESCE(reasoning, \'\') AS reasoning,';
  
  var baseQuery = `
    SELECT 
      bi_primary_id,
      candidate_name,
      requirement_name,
      current_role,
      current_company,
      email,
      total_experience,
      contact_number,
      notice_period,
      current_location,
      preferred_locations,
      education,
      current_ctc,
      source,
      match_percentage,
      selection_percentage,
      reasoning,
      status,
      resume,
      job_id,
      spoc
    FROM bi_t31s 
    WHERE job_id IN ('${jdIds.join("','")}')
  `;
  
  // Apply dynamic filters
  if (filters) {
    console.log('=== APPLYING FILTERS IN BACKEND ===');
    console.log('Filters received:', JSON.stringify(filters));
    console.log('Filter type:', typeof filters);
    console.log('Filter status:', filters.status);
    console.log('Filter jobTitle:', filters.jobTitle);
    console.log('Available JD Job Titles:', jdJobTitles);
    
    if (filters.jobTitle && filters.jobTitle !== '') {
      console.log('Filtering by job title:', filters.jobTitle);
      
      // Find JD IDs that match the selected job title
      var matchingJdIds = [];
      for (var jdId in jdJobTitles) {
        console.log('Checking JD', jdId, 'with job title:', jdJobTitles[jdId]);
        if (jdJobTitles[jdId] === filters.jobTitle) {
          matchingJdIds.push(jdId);
          console.log('Match found! JD', jdId, 'matches job title:', filters.jobTitle);
        }
      }
      
      console.log('Matching JD IDs for job title', filters.jobTitle, ':', matchingJdIds);
      
      if (matchingJdIds.length > 0) {
        // Update the query to use only matching JD IDs
        baseQuery = baseQuery.replace(
          `WHERE job_id IN ('${jdIds.join("','")}')`,
          `WHERE job_id IN ('${matchingJdIds.join("','")}')`
        );
        console.log('Updated query to filter by specific JDs:', baseQuery);
      } else {
        console.log('No matching JDs found for job title:', filters.jobTitle);
      }
    }
    
    if (filters.status && filters.status !== '') {
      var statusCondition = '';
      
      // Normalize the status to lowercase for comparison
      var statusLower = filters.status.toLowerCase();
      
      if (statusLower === 'shortlisted') {
        statusCondition = ` AND status = 'Shortlisted'`;
      } else if (statusLower === 'replied') {
        statusCondition = ` AND status = 'Replied'`;
      } else if (statusLower === 'booked') {
        statusCondition = ` AND status = 'Booked'`;
      } else if (statusLower === 'no-show') {
        statusCondition = ` AND (status = 'No-show' OR status = 'No_show')`;
      } else if (statusLower === 'disqualified') {
        statusCondition = ` AND status = 'Disqualified'`;
      } else if (statusLower === 'pending') {
        // Handle null, empty, or 'Pending' status
        statusCondition = ` AND (status IS NULL OR status = '' OR status = 'Pending')`;
      }
      
      console.log('Status condition generated:', statusCondition);
      
      if (statusCondition) {
        baseQuery += statusCondition;
      }
    }
  }
  
  // Add pagination
  baseQuery += ` ORDER BY bi_primary_id DESC LIMIT ${start}, ${pageSize}`;
  return baseQuery;
}

/**
 * Build total count query with same filters as candidates query
 * @param {Array} jdIds - Array of JD IDs
 * @param {Object} jdJobTitles - Object mapping JD IDs to job titles
 * @param {Object} filters - Filter object
 * @return {string} SQL query for total count
 */
function buildTotalCountQuery(jdIds, jdJobTitles, filters) {
  var baseQuery = `SELECT COUNT(*) as total FROM bi_t31s WHERE job_id IN ('${jdIds.join("','")}')`;
  
  // Apply same filters as candidates query
  if (filters) {
    console.log('Applying filters to count query:', filters);
    
    if (filters.jobTitle && filters.jobTitle !== '') {
      // Find JD IDs that match the selected job title
      var matchingJdIds = [];
      for (var jdId in jdJobTitles) {
        if (jdJobTitles[jdId] === filters.jobTitle) {
          matchingJdIds.push(jdId);
        }
      }
      
      if (matchingJdIds.length > 0) {
        baseQuery = baseQuery.replace(
          `WHERE job_id IN ('${jdIds.join("','")}')`,
          `WHERE job_id IN ('${matchingJdIds.join("','")}')`
        );
      }
    }
    
    if (filters.status && filters.status !== '') {
      var statusCondition = '';
      
      // Normalize the status to lowercase for comparison
      var statusLower = filters.status.toLowerCase();
      
      if (statusLower === 'shortlisted') {
        statusCondition = ` AND status = 'Shortlisted'`;
      } else if (statusLower === 'replied') {
        statusCondition = ` AND status = 'Replied'`;
      } else if (statusLower === 'booked') {
        statusCondition = ` AND status = 'Booked'`;
      } else if (statusLower === 'no-show') {
        statusCondition = ` AND (status = 'No-show' OR status = 'No_show')`;
      } else if (statusLower === 'disqualified') {
        statusCondition = ` AND status = 'Disqualified'`;
      } else if (statusLower === 'pending') {
        // Handle null, empty, or 'Pending' status
        statusCondition = ` AND (status IS NULL OR status = '' OR status = 'Pending')`;
      }
      
      console.log('Status condition generated:', statusCondition);
      
      if (statusCondition) {
        baseQuery += statusCondition;
      }
    }
  }
  
  return baseQuery;
}

/**
 * Update candidate status in database
 * @param {string} candidateId - Candidate ID to update
 * @param {string} newStatus - New status value
 * @return {Object} Update result
 */
function updateCandidateStatus(candidateId, newStatus) {
  try {
    console.log('=== UPDATING CANDIDATE STATUS ===');
    console.log('Candidate ID:', candidateId);
    console.log('New Status:', newStatus);
    
    // Validate inputs
    if (!candidateId || !newStatus) {
      return { success: false, message: 'Candidate ID and status are required' };
    }
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }
    
    // Handle special cases for status values
    var processedStatus = newStatus;
    if (newStatus === 'No-show') {
      // Try different variations that might work with the API
      processedStatus = 'No_show'; // Replace hyphen with underscore
    }
    
    // Build update query
    var updateQuery = `
      UPDATE bi_t31s 
      SET status = '${sqlSafe(processedStatus)}'
      WHERE bi_primary_id = '${sqlSafe(candidateId)}'
    `;
    
    console.log('Update query:', updateQuery);
    
    // Execute update
    var result = fetchFromAPI(updateQuery);
    console.log('Update result (raw):', JSON.stringify(result));
    
    if (
      (result && result.status === 'success') ||
      (typeof result === 'object' && result !== null && Object.keys(result).length === 0) || // Accept empty object as success
      result === null ||
      result === undefined ||
      result === true // Accept boolean true as success
    ) {
      return {
        success: true,
        message: 'Status updated successfully',
        candidateId: candidateId,
        newStatus: newStatus
      };
    } else {
      return {
        success: false,
        message: 'Failed to update status in database',
        error: result
      };
    }
    
  } catch (error) {
    console.error('Error updating candidate status:', error);
    return { 
      success: false, 
      message: 'Error updating candidate status: ' + error.toString()
    };
  }
}

function updateCandidateSPOC(candidateId, newSPOC) {
  try {
    console.log('=== UPDATING CANDIDATE SPOC ===');
    console.log('Candidate ID:', candidateId);
    console.log('New SPOC:', newSPOC);
    
    // Validate inputs
    if (!candidateId || !newSPOC) {
      return { success: false, message: 'Candidate ID and SPOC are required' };
    }
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }
    
    // Build update query
    var updateQuery = `
      UPDATE bi_t31s 
      SET spoc = '${sqlSafe(newSPOC)}'
      WHERE bi_primary_id = '${sqlSafe(candidateId)}'
    `;
    
    console.log('Update SPOC query:', updateQuery);
    
    // Execute update
    var result = fetchFromAPI(updateQuery);
    console.log('Update SPOC result (raw):', JSON.stringify(result));
    
    if (
      (result && result.status === 'success') ||
      (typeof result === 'object' && result !== null && Object.keys(result).length === 0) || // Accept empty object as success
      result === null ||
      result === undefined ||
      result === true // Accept boolean true as success
    ) {
      return {
        success: true,
        message: 'SPOC updated successfully',
        candidateId: candidateId,
        newSPOC: newSPOC
      };
    } else {
      return {
        success: false,
        message: 'Failed to update SPOC in database',
        error: result
      };
    }
    
  } catch (error) {
    console.error('Error updating candidate SPOC:', error);
    return { 
      success: false, 
      message: 'Error updating candidate SPOC: ' + error.toString()
    };
  }
}


/**
 * Process candidates from API result
 * @param {Array} result - API result array
 * @param {Object} jdJobTitles - Object mapping JD IDs to job titles
 * @return {Array} Array of processed candidates
 */
function processCandidatesFromResult(result, jdJobTitles) {
  var candidates = [];
  
  result.forEach(function(candidate, index) {
    var candidateData = candidate.bi_t31s || candidate;
    var coalesceData = candidate['0'] || {};
    var jdId = candidateData.job_id;
    var jobTitle = jdJobTitles[jdId] || 'Unknown';
    
    // Merge COALESCE data with main candidate data
    var mergedData = Object.assign({}, candidateData, coalesceData);
    
    // Debug: Log the raw candidate data
    console.log('Processing candidate:', mergedData.candidate_name);
    console.log('  Raw candidate data:', mergedData);
    console.log('  contact_number:', mergedData.contact_number);
    console.log('  notice_period:', mergedData.notice_period);
    console.log('  education:', mergedData.education);
    console.log('  current_ctc:', mergedData.current_ctc);
    console.log('  match_percentage:', mergedData.match_percentage);
    console.log('  selection_percentage:', mergedData.selection_percentage);
    console.log('  reasoning:', mergedData.reasoning);
    console.log('  resume:', mergedData.resume);
    
    candidates.push({
      id: mergedData.bi_primary_id || (index + 1),
      name: mergedData.candidate_name || 'Unknown',
      requirementName: mergedData.requirement_name || 'Not specified',
      currentRole: mergedData.current_role || 'Not specified',
      currentCompany: mergedData.current_company || 'Not specified',
      email: mergedData.email || 'No email',
      totalExperience: mergedData.total_experience || 'Not specified',
      contactNumber: mergedData.contact_number || 'Not specified',
      noticePeriod: mergedData.notice_period || 'Not specified',
      currentLocation: mergedData.current_location || 'Not specified',
      preferredLocation: mergedData.preferred_locations || 'Not specified',
      education: mergedData.education || 'Not specified',
      currentCtc: mergedData.current_ctc || 'Not specified',
      source: mergedData.source || 'Not specified',
      matchPercentage: mergedData.match_percentage || 'Not specified',
      selectionPercentage: mergedData.selection_percentage || 'Not specified',
      reasoning: mergedData.reasoning || (jdId === '784' ? 'Reasoning not available for this JD' : 'Not specified'),
      status: mapCandidateStatus(mergedData.status),
      resumeUrl: mergedData.resume || null,
      jobTitle: jobTitle,
      spoc: mergedData.spoc || 'Not assigned'
    });
  });
  
  return candidates;
}

/**
 * Debug function to test candidate retrieval
 */
function debugCandidateRetrieval() {
  try {
    console.log('=== DEBUGGING CANDIDATE RETRIEVAL ===');
    
    // Get user info
    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    
    console.log('User ID:', userId);
    console.log('User Name:', userName);
    
    // Test 1: Get candidate count
    console.log('\n--- TEST 1: CANDIDATE COUNT ---');
    var countResult = getCandidateCountForUser();
    console.log('Candidate count result:', countResult);
    
    // Test 2: Get JD IDs
    console.log('\n--- TEST 2: JD IDs ---');
    var jdIds = getUserAssignedJDIds();
    console.log('JD IDs:', jdIds);
    
    // Test 3: Get candidates with chunked loading
    console.log('\n--- TEST 3: CHUNKED LOADING ---');
    var jdJobTitles = {};
    var chunkedResult = getCandidatesInChunks(jdIds, jdJobTitles, {});
    console.log('Chunked loading result:', chunkedResult);
    
    // Test 4: Direct query for each JD
    console.log('\n--- TEST 4: DIRECT QUERIES FOR EACH JD ---');
    for (var i = 0; i < jdIds.length; i++) {
      var jdId = jdIds[i];
      var directQuery = `SELECT COUNT(*) as count FROM bi_t31s WHERE job_id = '${jdId}'`;
      console.log('Direct count query for JD', jdId, ':', directQuery);
      var directResult = fetchFromAPI(directQuery);
      console.log('Direct count result for JD', jdId, ':', directResult);
    }
    
    return {
      success: true,
      countResult: countResult,
      jdIds: jdIds,
      chunkedResult: chunkedResult
    };
    
  } catch (error) {
    console.error('Error in debug function:', error);
    return { success: false, error: error.toString() };
  }
}

function testCandidate92Query() {
  try {
    var query = `
      SELECT
        bi_primary_id,
        candidate_name,
        current_role,
        current_company,
        email,
        total_experience,
        contact_number,
        notice_period,
        current_location,
        preferred_locations,
        education,
        current_ctc,
        match_percentage,
        selection_percentage,
        COALESCE(reasoning, '') AS reasoning,
        status,
        resume,
        job_id
      FROM bi_t31s
      WHERE bi_primary_id = '92'
    `;
    console.log('Running test query for candidate 92:');
    console.log(query);
    var result = fetchFromAPI(query);
    console.log('Raw API response for candidate 92:', result);
    return result;
  } catch (error) {
    console.error('Error in testCandidate92Query:', error);
    return { success: false, error: error.toString() };
  }
}

function debugCandidateDuplicates(filters) {
  try {
    console.log('=== DEBUGGING CANDIDATE DUPLICATES ===');
    var result = getUserAssignedCandidates(filters || {});
    var candidates = result && result.data ? result.data : [];
    var ids = candidates.map(c => c.id || c.bi_primary_id);
    var uniqueIds = Array.from(new Set(ids));
    var duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    var duplicateSet = Array.from(new Set(duplicates));
    console.log('Total candidates returned:', candidates.length);
    console.log('Candidate IDs:', ids);
    console.log('Unique candidate IDs:', uniqueIds);
    console.log('Number of unique candidates:', uniqueIds.length);
    console.log('Duplicate IDs:', duplicateSet);
    return {
      total: candidates.length,
      unique: uniqueIds.length,
      duplicateIds: duplicateSet,
      ids: ids,
      uniqueIds: uniqueIds
    };
  } catch (error) {
    console.error('Error in debugCandidateDuplicates:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test function to log the raw API response for JD 784 candidate query
 */
function logJD784ApiResponse() {
  var jdId = '784';
  var pagedQuery = `
    SELECT 
      bi_primary_id,
      candidate_name,
      current_role,
      current_company,
      email,
      total_experience,
      contact_number,
      notice_period,
      current_location,
      preferred_locations,
      education,
      current_ctc,
      match_percentage,
      selection_percentage,
      COALESCE(reasoning, '') AS reasoning,
      job_id,
      status,
      resume
    FROM bi_t31s 
    WHERE job_id IN ('${jdId}')
    ORDER BY bi_primary_id DESC
    LIMIT 50 OFFSET 0
  `;
  var pageResult = fetchFromAPI(pagedQuery);
  console.log('DEBUG JD 784 RAW RESPONSE:', JSON.stringify(pageResult));
  return pageResult;
}

/**
 * Test function to log the raw API response for JD 784 with minimal columns
 */
function logJD784MinimalApiResponse() {
  var jdId = '784';
  var minimalQuery = `
    SELECT 
      bi_primary_id,
      candidate_name,
      job_id
    FROM bi_t31s 
    WHERE job_id IN ('${jdId}')
    ORDER BY bi_primary_id DESC
    LIMIT 50 OFFSET 0
  `;
  var pageResult = fetchFromAPI(minimalQuery);
  console.log('DEBUG JD 784 MINIMAL RAW RESPONSE:', JSON.stringify(pageResult));
  return pageResult;
}

/**
 * Test function to log the raw API response for JD 784 with a customizable set of columns
 * Edit the columns in the SELECT as needed to find the problematic column(s)
 */
function logJD784CustomApiResponse() {
  var jdId = '784';
  var customQuery = `
    SELECT 
      bi_primary_id,
      candidate_name,
      job_id
      -- Uncomment/add columns below one by one to test
      -- , current_role
      -- , current_company
      -- , email
      -- , total_experience
      -- , contact_number
      -- , notice_period
      -- , current_location
      -- , preferred_locations
      -- , education
      -- , current_ctc
      -- , match_percentage
      -- , selection_percentage
      -- , reasoning
      -- , status
      -- , resume
    FROM bi_t31s 
    WHERE job_id IN ('${jdId}')
    ORDER BY bi_primary_id DESC
    LIMIT 50 OFFSET 0
  `;
  var pageResult = fetchFromAPI(customQuery);
  console.log('DEBUG JD 784 CUSTOM RAW RESPONSE:', JSON.stringify(pageResult));
  return pageResult;
}

/**
 * Test function to verify pagination implementation
 */
function testPagination() {
  try {
    console.log('=== TESTING PAGINATION IMPLEMENTATION ===');
    
    // Test different pages
    var testPages = [1, 2, 3, 4, 5];
    var allResults = [];
    
    testPages.forEach(function(page) {
      console.log('--- Testing Page', page, '---');
      
      var filters = {
        page: page
      };
      
      var result = getUserAssignedCandidates(filters);
      console.log('Page', page, 'Result:');
      console.log('  Success:', result.success);
      console.log('  Data length:', result.data ? result.data.length : 0);
      console.log('  Pagination info:', result.pagination);
      
      if (result.pagination) {
        console.log('  Current Page:', result.pagination.currentPage);
        console.log('  Page Size:', result.pagination.pageSize);
        console.log('  Total Count:', result.pagination.totalCount);
        console.log('  Total Pages:', result.pagination.totalPages);
        console.log('  Has Next Page:', result.pagination.hasNextPage);
        console.log('  Has Prev Page:', result.pagination.hasPrevPage);
      }
      
      allResults.push({
        page: page,
        result: result
      });
    });
    
    // Summary
    console.log('=== PAGINATION TEST SUMMARY ===');
    console.log('Total pages tested:', testPages.length);
    console.log('Results:', allResults);
    
    return allResults;
    
  } catch (error) {
    console.error('Error in pagination test:', error);
    return { error: error.toString() };
  }
}

/**
 * Test function to verify page size is exactly 5
 */
function testPageSize() {
  try {
    console.log('=== TESTING PAGE SIZE (Should be 5) ===');
    
    var testPages = [1, 2, 3];
    var pageSizeResults = [];
    
    testPages.forEach(function(page) {
      console.log('--- Testing Page', page, 'for page size ---');
      
      var filters = {
        page: page
      };
      
      var result = getUserAssignedCandidates(filters);
      
      if (result.success && result.data) {
        var actualPageSize = result.data.length;
        var expectedPageSize = 5;
        var isCorrectSize = actualPageSize <= expectedPageSize; // Last page might have fewer
        
        console.log('Page', page, ':');
        console.log('  Expected max size:', expectedPageSize);
        console.log('  Actual size:', actualPageSize);
        console.log('  Size correct:', isCorrectSize);
        
        pageSizeResults.push({
          page: page,
          expectedSize: expectedPageSize,
          actualSize: actualPageSize,
          isCorrect: isCorrectSize
        });
      }
    });
    
    console.log('=== PAGE SIZE TEST SUMMARY ===');
    console.log('Page size results:', pageSizeResults);
    
    return pageSizeResults;
    
  } catch (error) {
    console.error('Error in page size test:', error);
    return { error: error.toString() };
  }
}

/**
 * Test function to verify pagination with filters
 */
function testPaginationWithFilters() {
  try {
    console.log('=== TESTING PAGINATION WITH FILTERS ===');
    
    var testCases = [
      { filters: { page: 1 }, description: 'Page 1, no filters' },
      { filters: { page: 2 }, description: 'Page 2, no filters' },
      { filters: { page: 1, jobTitle: 'Application Developer' }, description: 'Page 1, Application Developer filter' },
      { filters: { page: 2, jobTitle: 'Application Developer' }, description: 'Page 2, Application Developer filter' },
      { filters: { page: 1, status: 'active' }, description: 'Page 1, active status filter' },
      { filters: { page: 2, status: 'active' }, description: 'Page 2, active status filter' }
    ];
    
    var filterResults = [];
    
    testCases.forEach(function(testCase, index) {
      console.log('--- Test Case', (index + 1), ':', testCase.description, '---');
      
      var result = getUserAssignedCandidates(testCase.filters);
      
      console.log('Filters:', testCase.filters);
      console.log('Result:');
      console.log('  Success:', result.success);
      console.log('  Data length:', result.data ? result.data.length : 0);
      console.log('  Pagination:', result.pagination);
      
      filterResults.push({
        testCase: testCase,
        result: result
      });
    });
    
    console.log('=== FILTER PAGINATION TEST SUMMARY ===');
    console.log('Filter test results:', filterResults);
    
    return filterResults;
    
  } catch (error) {
    console.error('Error in filter pagination test:', error);
    return { error: error.toString() };
  }
}

/**
 * Test function to verify SQL query structure
 */
function testSQLQueryStructure() {
  try {
    console.log('=== TESTING SQL QUERY STRUCTURE ===');
    
    // Test the buildPaginatedCandidatesQuery function directly
    var testJdIds = ['784', '785', '786'];
    var testJdJobTitles = {
      '784': 'Application Developer',
      '785': 'QA/QC Engineer', 
      '786': 'HR'
    };
    var testFilters = { jobTitle: 'Application Developer' };
    var testStart = 0;
    var testPageSize = 5;
    
    console.log('Test parameters:');
    console.log('  JD IDs:', testJdIds);
    console.log('  JD Job Titles:', testJdJobTitles);
    console.log('  Filters:', testFilters);
    console.log('  Start:', testStart);
    console.log('  Page Size:', testPageSize);
    
    var query = buildPaginatedCandidatesQuery(testJdIds, testJdJobTitles, testFilters, testStart, testPageSize);
    
    console.log('Generated SQL Query:');
    console.log(query);
    
    // Check if query contains expected elements
    var hasLimit = query.includes('LIMIT');
    var hasOffset = query.includes('0, 5');
    var hasOrderBy = query.includes('ORDER BY');
    var hasWhere = query.includes('WHERE');
    
    console.log('=== SQL QUERY STRUCTURE CHECK ===');
    console.log('Has LIMIT clause:', hasLimit);
    console.log('Has correct offset (0, 5):', hasOffset);
    console.log('Has ORDER BY clause:', hasOrderBy);
    console.log('Has WHERE clause:', hasWhere);
    
    var structureResults = {
      query: query,
      hasLimit: hasLimit,
      hasOffset: hasOffset,
      hasOrderBy: hasOrderBy,
      hasWhere: hasWhere,
      isStructureCorrect: hasLimit && hasOffset && hasOrderBy && hasWhere
    };
    
    console.log('Structure check results:', structureResults);
    
    return structureResults;
    
  } catch (error) {
    console.error('Error in SQL query structure test:', error);
    return { error: error.toString() };
  }
}

/**
 * Comprehensive test function that runs all pagination tests
 */
function runAllPaginationTests() {
  try {
    console.log('=== RUNNING ALL PAGINATION TESTS ===');
    
    var allTestResults = {};
    
    // Test 1: Basic pagination
    console.log('\n1. Testing basic pagination...');
    allTestResults.paginationTest = testPagination();
    
    // Test 2: Page size verification
    console.log('\n2. Testing page size...');
    allTestResults.pageSizeTest = testPageSize();
    
    // Test 3: Pagination with filters
    console.log('\n3. Testing pagination with filters...');
    allTestResults.filterPaginationTest = testPaginationWithFilters();
    
    // Test 4: SQL query structure
    console.log('\n4. Testing SQL query structure...');
    allTestResults.sqlStructureTest = testSQLQueryStructure();
    
    console.log('\n=== ALL TESTS COMPLETED ===');
    console.log('Complete test results:', allTestResults);
    
    return allTestResults;
    
  } catch (error) {
    console.error('Error running all pagination tests:', error);
    return { error: error.toString() };
  }
}

/**
 * Quick test function for immediate verification
 */
function quickPaginationTest() {
  try {
    console.log('=== QUICK PAGINATION TEST ===');
    
    // Test page 1
    var page1Result = getUserAssignedCandidates({ page: 1 });
    console.log('Page 1 result:', page1Result);
    
    // Test page 2
    var page2Result = getUserAssignedCandidates({ page: 2 });
    console.log('Page 2 result:', page2Result);
    
    // Summary
    var summary = {
      page1: {
        success: page1Result.success,
        dataLength: page1Result.data ? page1Result.data.length : 0,
        pagination: page1Result.pagination
      },
      page2: {
        success: page2Result.success,
        dataLength: page2Result.data ? page2Result.data.length : 0,
        pagination: page2Result.pagination
      }
    };
    
    console.log('Quick test summary:', summary);
    return summary;
    
  } catch (error) {
    console.error('Error in quick pagination test:', error);
    return { error: error.toString() };
  }
}

/**
 * Get all unique job IDs from bi_t33s table for the dropdown
 * @return {Object} Result object with job IDs data
 */
function getSearchJobIds() {
  try {
    console.log('=== GETTING SEARCH JOB IDS ===');
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }
    
    // Query to get distinct job IDs from bi_t33s table
    var sqlQuery = `
      SELECT DISTINCT job_id 
      FROM bi_t33s 
      WHERE job_id IS NOT NULL 
      AND job_id != ''
      ORDER BY job_id ASC
    `;
    
    console.log('Search job IDs query:', sqlQuery);
    
    var result = fetchFromAPI(sqlQuery);
    console.log('Search job IDs result:', result);
    
    var jobIds = [];
    
    // Handle both response formats: full object or direct data array
    if (result && result.status === 'success' && result.data && result.data.length > 0) {
      console.log('Using full response object format for job IDs');
      result.data.forEach(function(item) {
        var jobData = item.bi_t33s || item;
        if (jobData && jobData.job_id) {
          jobIds.push(jobData.job_id);
        }
      });
    } else if (result && Array.isArray(result) && result.length > 0) {
      console.log('Using direct data array format for job IDs');
      result.forEach(function(item) {
        var jobData = item.bi_t33s || item;
        if (jobData && jobData.job_id) {
          jobIds.push(jobData.job_id);
        }
      });
    }
    
    console.log('Found job IDs for search:', jobIds);
    
    return {
      success: true,
      data: jobIds,
      message: 'Found ' + jobIds.length + ' job IDs for search'
    };
    
  } catch (error) {
    console.error('Error getting search job IDs:', error);
    return { success: false, data: [], message: 'Error retrieving job IDs' };
  }
}

/**
 * Search bi_t33s table by job ID
 * @param {string} jobId - Job ID to search for
 * @return {Object} Result object with matching records
 */
function searchBiT33sByJobId(jobId) {
  try {
    console.log('=== SEARCHING BI_T33S BY JOB ID ===');
    console.log('Searching for job ID:', jobId);
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }
    
    if (!jobId || jobId.trim() === '') {
      console.log('No job ID provided');
      return { success: false, message: 'Job ID is required' };
    }
    
    // Query to search bi_t33s table by job_id
    var sqlQuery = `
      SELECT 
        bi_primary_id,
        job_id,
        candidate_name,
        current_job_title,
        linkedin_link,
        snippet,
        startindex,
        hasmoreresults
      FROM bi_t33s 
      WHERE job_id = '${sqlSafe(jobId)}'
      ORDER BY bi_primary_id ASC
    `;
    
    console.log('Search bi_t33s query:', sqlQuery);
    
    var result = fetchFromAPI(sqlQuery);
    console.log('Search bi_t33s result:', result);
    
    var searchResults = [];
    
    // Handle both response formats: full object or direct data array
    if (result && result.status === 'success' && result.data && result.data.length > 0) {
      console.log('Using full response object format for search results');
      result.data.forEach(function(item) {
        var searchData = item.bi_t33s || item;
        if (searchData) {
          searchResults.push({
            id: searchData.bi_primary_id || '',
            jobId: searchData.job_id || '',
            candidateName: searchData.candidate_name || 'Not specified',
            currentJobTitle: searchData.current_job_title || 'Not specified',
            linkedinLink: 'Not available (API restriction)', // API blocks linkedin_link field
            snippet: searchData.snippet || 'Not specified',
            startIndex: searchData.startindex || '',
            hasMoreResults: searchData.hasmoreresults || ''
          });
        }
      });
    } else if (result && Array.isArray(result) && result.length > 0) {
      console.log('Using direct data array format for search results');
      result.forEach(function(item) {
        var searchData = item.bi_t33s || item;
        if (searchData) {
          searchResults.push({
            id: searchData.bi_primary_id || '',
            jobId: searchData.job_id || '',
            candidateName: searchData.candidate_name || 'Not specified',
            currentJobTitle: searchData.current_job_title || 'Not specified',
            linkedinLink: 'Not available (API restriction)', // API blocks linkedin_link field
            snippet: searchData.snippet || 'Not specified',
            startIndex: searchData.startindex || '',
            hasMoreResults: searchData.hasmoreresults || ''
          });
        }
      });
    }
    
    console.log('Found search results:', searchResults.length, 'records');
    
    return {
      success: true,
      data: searchResults,
      message: 'Found ' + searchResults.length + ' records for job ID: ' + jobId
    };
    
  } catch (error) {
    console.error('Error searching bi_t33s by job ID:', error);
    return { success: false, data: [], message: 'Error searching database' };
  }
}


/**
 * Search bi_t33s table by job title (requirement_name from bi_t14s)
 * @param {string} jobTitle - Job title to search for
 * @return {Object} Result object with matching records
 */
function searchBiT33sByJobTitle(jobTitle) {
  try {
    console.log('=== SEARCHING BI_T33S BY JOB TITLE ===');
    console.log('Searching for job title:', jobTitle);
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }
    
    if (!jobTitle || jobTitle.trim() === '') {
      console.log('No job title provided');
      return { success: false, message: 'Job title is required' };
    }
    
    // Get user's first and last name from properties
    var firstName = props.getProperty('first_name');
    var lastName = props.getProperty('last_name');
    var userName = props.getProperty('userName');
    
    console.log('User Name:', userName);
    console.log('First Name:', firstName);
    console.log('Last Name:', lastName);
    
    // Get user data from database to ensure we have the correct names
    var userQuery = `SELECT first_name, last_name FROM users WHERE user_id = '${sqlSafe(userId)}'`;
    console.log('User data query:', userQuery);
    
    var userResult = fetchFromAPI(userQuery);
    var actualFirstName = '';
    var actualLastName = '';
    var actualFullName = '';
    
    // Handle both response formats: full object or direct data array
    var userDataArray = null;
    if (userResult && userResult.status === 'success' && userResult.data && userResult.data.length > 0) {
      userDataArray = userResult.data;
      console.log('Using full response object format');
    } else if (userResult && Array.isArray(userResult) && userResult.length > 0) {
      userDataArray = userResult;
      console.log('Using direct data array format');
    }
    
    if (userDataArray && userDataArray.length > 0) {
      var userData = userDataArray[0].users;
      actualFirstName = userData.first_name || '';
      actualLastName = userData.last_name || '';
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      
      console.log('Retrieved user data from DB - FirstName:', actualFirstName, 'LastName:', actualLastName, 'FullName:', actualFullName);
    } else {
      console.log('Could not retrieve user data from DB, using stored values');
      actualFirstName = firstName || '';
      actualLastName = lastName || '';
      actualFullName = userName || '';
    }
    
    // Ensure we have the full name constructed properly
    if (!actualFullName || actualFullName.trim() === '') {
      actualFullName = (actualFirstName + ' ' + actualLastName).trim();
      console.log('Constructed full name from parts:', actualFullName);
    }
    
    // Build the WHERE clause based on available user data
    var whereConditions = [];
    
    // Add conditions for full name only
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
      console.log('Added full name conditions for:', actualFullName);
    } else if (actualFirstName && actualFirstName.trim() !== '') {
      // Fallback to first name if full name is not available
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFirstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFirstName)}%'`);
      console.log('Added first name conditions for:', actualFirstName);
    }
    
    // Only proceed if we have name conditions
    if (whereConditions.length === 0) {
      console.log('No name available, returning empty result');
      return { success: true, data: [], message: 'No name available for search' };
    }
    
    var whereClause = whereConditions.join(' OR ');
    
    // Let's also test the exact query that should work based on our test results
    console.log('=== TESTING EXACT MATCH FOR QA/QC ENGINEER ===');
    var testQuery = `SELECT bi_primary_id, requirement_name, assign_to FROM bi_t14s WHERE requirement_name = 'QA/QC Engineer' AND assign_to LIKE '%Gayatri%'`;
    console.log('Test query:', testQuery);
    var testResult = fetchFromAPI(testQuery);
    console.log('Test result:', testResult);
    
    // First, get JD IDs that match the job title and are assigned to the user
    var jdQuery = `
      SELECT bi_primary_id as jd_id 
      FROM bi_t14s 
      WHERE (${whereClause})
      AND requirement_status = 'Open'
      AND requirement_name = '${sqlSafe(jobTitle)}'
    `;
    
    console.log('JD query for job title:', jdQuery);
    
    var jdResult = fetchFromAPI(jdQuery);
    var jdIds = [];
    
    if (jdResult && Array.isArray(jdResult) && jdResult.length > 0) {
      jdResult.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
        }
      });
    } else if (jdResult && jdResult.status === 'success' && jdResult.data && jdResult.data.length > 0) {
      jdResult.data.forEach(function(item) {
        var jdData = item.bi_t14s || item;
        if (jdData && jdData.jd_id) {
          jdIds.push(jdData.jd_id);
        }
      });
    }
    
    console.log('Found JDs for job title:', jdIds);
    console.log('JD IDs as strings:', jdIds.map(id => String(id)));
    
    if (jdIds.length === 0) {
      console.log('No JDs found for job title:', jobTitle);
      return { success: true, data: [], message: 'No JDs found for job title: ' + jobTitle };
    }
    
    // Let's also check if there's any data in bi_t33s table at all
    var checkQuery = `SELECT COUNT(*) as total_count FROM bi_t33s`;
    console.log('Checking total bi_t33s records:', checkQuery);
    var checkResult = fetchFromAPI(checkQuery);
    console.log('Total bi_t33s records:', checkResult);
    
    // Check if any of our JD IDs exist in bi_t33s
    var sampleQuery = `SELECT DISTINCT job_id FROM bi_t33s WHERE job_id IS NOT NULL LIMIT 10`;
    console.log('Sample job_ids in bi_t33s:', sampleQuery);
    var sampleResult = fetchFromAPI(sampleQuery);
    console.log('Sample job_ids in bi_t33s:', sampleResult);
    
    // Let's also check what job_ids exist in bi_t33s that match our JD IDs
    var matchQuery = `SELECT job_id, COUNT(*) as count FROM bi_t33s WHERE job_id IN (${jdIds.join(',')}) GROUP BY job_id`;
    console.log('Matching job_ids query:', matchQuery);
    var matchResult = fetchFromAPI(matchQuery);
    console.log('Matching job_ids result:', matchResult);
    
    // Let's also directly check the specific record we know exists (job_id 782)
    var directQuery = `SELECT * FROM bi_t33s WHERE job_id = 782`;
    console.log('Direct query for job_id 782:', directQuery);
    var directResult = fetchFromAPI(directQuery);
    console.log('Direct result for job_id 782:', directResult);
    
    // UNIVERSAL SOLUTION: Fetch IDs first, then detailed data row-by-row
    // Step 1: Get all bi_primary_ids (2-column query always works)
    var idsQuery = `
      SELECT 
        bi_primary_id,
        job_id
      FROM bi_t33s 
      WHERE job_id IN (${jdIds.join(',')})
      ORDER BY bi_primary_id ASC
    `;
    
    console.log('Step 1: Fetching candidate IDs (2-column query):', idsQuery);
    
    var idsResult = fetchFromAPI(idsQuery);
    console.log('IDs result:', idsResult);
    
    var searchResults = [];
    
    // Handle both response formats for IDs
    var candidateIds = [];
    if (idsResult && idsResult.status === 'success' && idsResult.data && idsResult.data.length > 0) {
      idsResult.data.forEach(function(item) {
        var idData = item.bi_t33s || item;
        if (idData && idData.bi_primary_id) {
          candidateIds.push({
            id: idData.bi_primary_id,
            jobId: idData.job_id
          });
        }
      });
    } else if (idsResult && Array.isArray(idsResult) && idsResult.length > 0) {
      idsResult.forEach(function(item) {
        var idData = item.bi_t33s || item;
        if (idData && idData.bi_primary_id) {
          candidateIds.push({
            id: idData.bi_primary_id,
            jobId: idData.job_id
          });
        }
      });
    }
    
    console.log('Found ' + candidateIds.length + ' candidate IDs to fetch details for');
    
    // Step 2: Fetch detailed data for each candidate row-by-row
    // This handles special characters gracefully
    candidateIds.forEach(function(candidate, index) {
      console.log('Fetching details for candidate ID:', candidate.id, '(' + (index + 1) + '/' + candidateIds.length + ')');
      
      try {
        // Try to fetch full details for this specific candidate
        var detailQuery = `
          SELECT 
            bi_primary_id,
            job_id,
            candidate_name,
            current_job_title,
            snippet,
            startindex,
            hasmoreresults
          FROM bi_t33s 
          WHERE bi_primary_id = ${parseInt(candidate.id)}
          LIMIT 1
        `;
        
        var detailResult = fetchFromAPI(detailQuery);
        
        // Check if we got data
        var detailData = null;
        if (detailResult && detailResult.status === 'success' && detailResult.data && detailResult.data.length > 0) {
          detailData = detailResult.data[0].bi_t33s || detailResult.data[0];
        } else if (detailResult && Array.isArray(detailResult) && detailResult.length > 0) {
          detailData = detailResult[0].bi_t33s || detailResult[0];
        }
        
        if (detailData) {
          // Successfully fetched full details
          searchResults.push({
            id: detailData.bi_primary_id || candidate.id,
            jobId: detailData.job_id || candidate.jobId,
            candidateName: detailData.candidate_name || 'Not specified',
            currentJobTitle: detailData.current_job_title || 'Not specified',
            linkedinLink: 'Not available (API restriction)', // API blocks linkedin_link field
            snippet: detailData.snippet || 'Not specified',
            startIndex: detailData.startindex || '',
            hasMoreResults: detailData.hasmoreresults || ''
          });
          console.log('✓ Successfully fetched details for ID:', candidate.id);
        } else {
          // API blocked this specific row (special characters)
          // Add with limited info
          searchResults.push({
            id: candidate.id,
            jobId: candidate.jobId,
            candidateName: 'Data contains special characters (API restricted)',
            currentJobTitle: 'Data contains special characters (API restricted)',
            linkedinLink: 'Not available (API restriction)',
            snippet: 'Data contains special characters (API restricted)',
            startIndex: 'N/A',
            hasMoreResults: 'N/A'
          });
          console.log('⚠ API blocked details for ID:', candidate.id, '(special characters in data)');
        }
      } catch (error) {
        // Error fetching this specific candidate
        console.error('Error fetching details for ID:', candidate.id, error);
        searchResults.push({
          id: candidate.id,
          jobId: candidate.jobId,
          candidateName: 'Error fetching data',
          currentJobTitle: 'Error fetching data',
          linkedinLink: 'Not available (API restriction)',
          snippet: 'Error fetching data',
          startIndex: 'N/A',
          hasMoreResults: 'N/A'
        });
      }
    });
    
    console.log('Successfully fetched details for ' + searchResults.length + ' candidates');
    
    // Count how many had special character issues
    var blockedCount = searchResults.filter(function(r) { 
      return r.candidateName.indexOf('special characters') !== -1; 
    }).length;
    
    var message = 'Found ' + searchResults.length + ' candidates for ' + jobTitle;
    if (blockedCount > 0) {
      message += ' (' + blockedCount + ' with restricted data due to special characters)';
    }
    
    return {
      success: true,
      data: searchResults,
      totalCandidates: searchResults.length,
      restrictedCandidates: blockedCount,
      message: message
    };
    
  } catch (error) {
    console.error('Error searching bi_t33s by job title:', error);
    return { success: false, data: [], message: 'Error searching database' };
  }
}


/**
 * Check if search has already been executed for a job title
 * @param {string} jobTitle - The job title to check
 * @return {Object} Result object with search status
 */
function checkSearchExecuted(jobTitle) {
  try {
    console.log('=== CHECKING SEARCH EXECUTED STATUS ===');
    console.log('Job title:', jobTitle);
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      return { success: false, message: 'User not logged in' };
    }
    
    if (!jobTitle || jobTitle.trim() === '') {
      return { success: false, message: 'Job title is required' };
    }
    
    // Get user name for assignment check
    var firstName = props.getProperty('first_name');
    var lastName = props.getProperty('last_name');
    var userName = props.getProperty('userName');
    var actualFullName = (firstName + ' ' + lastName).trim() || userName || '';
    
    // Build WHERE clause for assignment
    var whereConditions = [];
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
    } else if (firstName && firstName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(firstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(firstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(firstName)}%'`);
    }
    
    if (whereConditions.length === 0) {
      return { success: false, message: 'No user assignment found' };
    }
    
    var whereClause = whereConditions.join(' OR ');
    
    // Query to check search_executed flag
    var checkQuery = `
      SELECT bi_primary_id, requirement_name, search_executed 
      FROM bi_t14s 
      WHERE requirement_name = '${sqlSafe(jobTitle)}'
      AND (${whereClause})
      AND requirement_status = 'Open'
      LIMIT 1
    `;
    
    console.log('Check query:', checkQuery);
    var result = fetchFromAPI(checkQuery);
    console.log('Check result:', result);
    
    // Parse result
    var jobData = null;
    if (result && result.status === 'success' && result.data && result.data.length > 0) {
      jobData = result.data[0].bi_t14s || result.data[0];
    } else if (result && Array.isArray(result) && result.length > 0) {
      jobData = result[0].bi_t14s || result[0];
    }
    
    if (!jobData) {
      return {
        success: false,
        message: 'Job title not found or not assigned to you',
        alreadySearched: false
      };
    }
    
    var searchExecuted = parseInt(jobData.search_executed) || 0;
    var jobId = jobData.bi_primary_id;
    
    console.log('Job ID:', jobId);
    console.log('Search executed flag:', searchExecuted);
    
    // Check if search was already executed
    if (searchExecuted === 1) {
      // Get count of existing candidates
      var countQuery = `SELECT COUNT(*) as count FROM bi_t33s WHERE job_id = ${parseInt(jobId)}`;
      var countResult = fetchFromAPI(countQuery);
      
      var candidateCount = 0;
      if (countResult && Array.isArray(countResult) && countResult.length > 0) {
        if (countResult[0] && Array.isArray(countResult[0]) && countResult[0].length > 0) {
          candidateCount = parseInt(countResult[0][0].count) || 0;
        } else if (countResult[0] && countResult[0].bi_t33s) {
          candidateCount = parseInt(countResult[0].bi_t33s.count) || 0;
        } else if (countResult[0] && countResult[0].count) {
          candidateCount = parseInt(countResult[0].count) || 0;
        }
      }
      
      console.log('Existing candidate count:', candidateCount);
      
      return {
        success: true,
        alreadySearched: true,
        jobId: jobId,
        jobTitle: jobTitle,
        candidateCount: candidateCount,
        message: `You have reached the limit to get the leads for "${jobTitle}".`
      };
    } else {
      return {
        success: true,
        alreadySearched: false,
        jobId: jobId,
        message: `Search not yet executed for "${jobTitle}". Ready to search.`
      };
    }
    
  } catch (error) {
    console.error('Error checking search executed status:', error);
    return {
      success: false,
      message: 'Error checking search status: ' + error.toString()
    };
  }
}

/**
 * Mark search as executed for a job title
 * @param {number} jobId - The job ID (bi_primary_id from bi_t14s)
 * @return {Object} Result object
 */
function markSearchAsExecuted(jobId) {
  try {
    console.log('=== MARKING SEARCH AS EXECUTED ===');
    console.log('Job ID:', jobId);
    
    var updateQuery = `UPDATE bi_t14s SET search_executed = 1 WHERE bi_primary_id = ${parseInt(jobId)}`;
    console.log('Update query:', updateQuery);
    
    var result = fetchFromAPI(updateQuery);
    console.log('Update result:', result);
    
    return {
      success: true,
      message: 'Search marked as executed'
    };
    
  } catch (error) {
    console.error('Error marking search as executed:', error);
    return {
      success: false,
      message: 'Error updating search status: ' + error.toString()
    };
  }
}

/**
 * Call N8N webhook with selected option and user data
 * @param {string} selectedOption - The selected dropdown option
 * @return {Object} Result object with webhook response
 */
function callN8NWebhook(selectedOption) {
  try {
    console.log('=== CALLING N8N WEBHOOK ===');
    console.log('Selected option:', selectedOption);
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }
    
    if (!selectedOption || selectedOption.trim() === '') {
      console.log('No selected option provided');
      return { success: false, message: 'Selected option is required' };
    }
    
    // STEP 1: Check if search was already executed
    var searchCheck = checkSearchExecuted(selectedOption);
    console.log('Search check result:', searchCheck);
    
    if (searchCheck.alreadySearched) {
      console.log('Search already executed - returning existing candidates');
      
      // Fetch existing candidates from bi_t33s
      var existingCandidates = searchBiT33sByJobTitleForUser(selectedOption);
      
      return {
        success: true,
        alreadySearched: true,
        data: existingCandidates.data || [],
        candidateCount: searchCheck.candidateCount,
        message: searchCheck.message,
        note: 'Showing previously searched candidates. Search was not re-executed.'
      };
    }
    
    console.log('Search not executed yet - proceeding with webhook call');
    
    // Get jobId from searchCheck result (already fetched from checkSearchExecuted)
    var jobId = searchCheck.jobId;
    console.log('Job ID from searchCheck:', jobId);
    
    // Get user data from properties
    var userData = {
      user_id: props.getProperty('user_id'),
      email: props.getProperty('email'),
      first_name: props.getProperty('first_name'),
      last_name: props.getProperty('last_name'),
      userName: props.getProperty('userName'),
      role: props.getProperty('role'),
      employee_id: props.getProperty('employee_id'),
      current_status: props.getProperty('current_status')
    };
    
    console.log('User data:', userData);
    
    // Get past_company and client_name from bi_t14s using jobId
    var jobDetailsQuery = `
      SELECT past_company, client_name 
      FROM bi_t14s 
      WHERE bi_primary_id = ${parseInt(jobId)} 
      AND requirement_status = 'Open'
      LIMIT 1
    `;
    console.log('Job details query:', jobDetailsQuery);
    var jobDetailsResult = fetchFromAPI(jobDetailsQuery);
    console.log('Job details result:', JSON.stringify(jobDetailsResult));
    
    var pastCompany = '';
    var clientName = '';
    var clientIndustry1 = '';
    
    // Extract past_company and client_name from job details
    if (jobDetailsResult && Array.isArray(jobDetailsResult) && jobDetailsResult.length > 0) {
      var jobData = jobDetailsResult[0].bi_t14s || jobDetailsResult[0];
      pastCompany = jobData.past_company || '';
      clientName = jobData.client_name || '';
      console.log('Extracted past_company:', pastCompany);
      console.log('Extracted client_name:', clientName);
    } else if (jobDetailsResult && jobDetailsResult.status === 'success' && jobDetailsResult.data && jobDetailsResult.data.length > 0) {
      var jobData = jobDetailsResult.data[0].bi_t14s || jobDetailsResult.data[0];
      pastCompany = jobData.past_company || '';
      clientName = jobData.client_name || '';
      console.log('Extracted past_company:', pastCompany);
      console.log('Extracted client_name:', clientName);
    }
    
    // Get client_industry1 from bi_t8s using the client_name
    if (clientName) {
      var clientIndustryQuery = `
        SELECT client_industry1 
        FROM bi_t8s 
        WHERE client_name = '${sqlSafe(clientName)}' 
        LIMIT 1
      `;
      console.log('Client industry query:', clientIndustryQuery);
      var clientIndustryResult = fetchFromAPI(clientIndustryQuery);
      console.log('Client industry result:', JSON.stringify(clientIndustryResult));
      
      // Extract client_industry1
      if (clientIndustryResult && Array.isArray(clientIndustryResult) && clientIndustryResult.length > 0) {
        var clientData = clientIndustryResult[0].bi_t8s || clientIndustryResult[0];
        clientIndustry1 = clientData.client_industry1 || '';
        console.log('Extracted client_industry1:', clientIndustry1);
      } else if (clientIndustryResult && clientIndustryResult.status === 'success' && clientIndustryResult.data && clientIndustryResult.data.length > 0) {
        var clientData = clientIndustryResult.data[0].bi_t8s || clientIndustryResult.data[0];
        clientIndustry1 = clientData.client_industry1 || '';
        console.log('Extracted client_industry1:', clientIndustry1);
      }
    }
    
    // N8N webhook URL
    var webhookUrl = "http://automation.teamob.io:5678/webhook/ff1da0b6-fc87-4d56-936b-61faf151b3ff";
    
    // Prepare the payload with JD ID (bi_primary_id), user data, past_company, and client_industry1
    var payload = {
      jdId: jobId,
      userData: userData,
      pastCompany: pastCompany,
      clientIndustry1: clientIndustry1
    };
    
    console.log('Webhook URL:', webhookUrl);
    console.log('Payload:', payload);
    
    // Make the webhook call
    var options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(webhookUrl, options);
    var responseText = response.getContentText();
    var responseCode = response.getResponseCode();
    
    console.log('Webhook response code:', responseCode);
    console.log('Webhook response text:', responseText);
    
    // Check if the request was successful
    if (responseCode >= 200 && responseCode < 300) {
      // STEP 2: Mark search as executed after successful webhook call
      if (searchCheck.jobId) {
        console.log('Marking search as executed for job ID:', searchCheck.jobId);
        var markResult = markSearchAsExecuted(searchCheck.jobId);
        console.log('Mark result:', markResult);
      }
      
      try {
        // Try to parse the JSON response
        var jsonResponse = JSON.parse(responseText);
        console.log('Parsed webhook response:', jsonResponse);
        
        return {
          success: true,
          alreadySearched: false,
          data: jsonResponse,
          message: 'Search started successfully!',
          note: 'Your search request has been received and is now being processed. Please wait for 2–4 minutes, then refresh the page to view your updated leads.'
        };
      } catch (parseError) {
        console.log('Failed to parse webhook response as JSON:', parseError);
        return {
          success: true,
          alreadySearched: false,
          data: responseText,
          message: 'Webhook call successful (non-JSON response) - New search executed',
          note: 'Search has been marked as executed. Future searches will use cached results.'
        };
      }
    } else {
      console.log('Webhook call failed with status:', responseCode);
      return {
        success: false,
        message: 'Webhook call failed with status: ' + responseCode
      };
    }
    
  } catch (error) {
    console.error('Error calling N8N webhook:', error);
    return { 
      success: false, 
      message: 'Error calling webhook: ' + error.toString() 
    };
  }
}

/**
 * Search bi_t33s table by job title (requirement_name from bi_t14s) for the logged-in user
 * @param {string} jobTitle - Job title to search for
 * @return {Object} Result object with matching records
 */
function searchBiT33sByJobTitleForUser(jobTitle) {
  try {
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    if (!isLoggedIn || !userId) {
      return { success: false, message: 'User not logged in' };
    }
    if (!jobTitle || jobTitle.trim() === '') {
      return { success: false, message: 'Job title is required' };
    }

    // Get user name info
    var firstName = props.getProperty('first_name');
    var lastName = props.getProperty('last_name');
    var userName = props.getProperty('userName');
    var actualFullName = (firstName + ' ' + lastName).trim() || userName || '';

    // Build WHERE clause for assignment
    var whereConditions = [];
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
    } else if (firstName && firstName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(firstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(firstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(firstName)}%'`);
    }
    if (whereConditions.length === 0) {
      return { success: true, data: [], message: 'No name available for search' };
    }
    var whereClause = whereConditions.join(' OR ');

    // 1. Get bi_primary_id for this job title assigned to this user
    var jdQuery = `
      SELECT bi_primary_id
      FROM bi_t14s
      WHERE (${whereClause})
        AND requirement_status = 'Open'
        AND requirement_name = '${sqlSafe(jobTitle)}'
      LIMIT 1
    `;
    var jdResult = fetchFromAPI(jdQuery);
    var bi_primary_id = null;
    if (jdResult && Array.isArray(jdResult) && jdResult.length > 0) {
      var jdData = jdResult[0].bi_t14s || jdResult[0];
      bi_primary_id = jdData.bi_primary_id;
    } else if (jdResult && jdResult.status === 'success' && jdResult.data && jdResult.data.length > 0) {
      var jdData = jdResult.data[0].bi_t14s || jdResult.data[0];
      bi_primary_id = jdData.bi_primary_id;
    }
    if (!bi_primary_id) {
      return { success: true, data: [], message: 'No JD found for this job title and user' };
    }

    // 2. Fetch from bi_t33s where job_id = bi_primary_id (only required columns)
    var sqlQuery = `
      SELECT 
        candidate_name,
        current_job_title,
        linkedin_link
      FROM bi_t33s
      WHERE job_id = '${sqlSafe(bi_primary_id)}'
      ORDER BY candidate_name ASC
    `;
    var result = fetchFromAPI(sqlQuery);
    var searchResults = [];
    if (result && result.status === 'success' && result.data && result.data.length > 0) {
      result.data.forEach(function(item) {
        var searchData = item.bi_t33s || item;
        if (searchData) {
          searchResults.push({
            candidateName: searchData.candidate_name || 'Not specified',
            currentJobTitle: searchData.current_job_title || 'Not specified',
            linkedinLink: searchData.linkedin_link || ''
          });
        }
      });
    } else if (result && Array.isArray(result) && result.length > 0) {
      result.forEach(function(item) {
        var searchData = item.bi_t33s || item;
        if (searchData) {
          searchResults.push({
            candidateName: searchData.candidate_name || 'Not specified',
            currentJobTitle: searchData.current_job_title || 'Not specified',
            linkedinLink: searchData.linkedin_link || ''
          });
        }
      });
    }
    return {
      success: true,
      data: searchResults,
      message: 'Found ' + searchResults.length + ' records for job title: ' + jobTitle
    };
  } catch (error) {
    return { success: false, data: [], message: 'Error searching database' };
  }
}

/**
 * Test function for searchBiT33sByJobTitleForUser with job title 'QA/QC Engineer'
 * Logs and returns the result.
 */
function testSearchBiT33sByJobTitleForUser_QAQCEngineer() {
  var jobTitle = 'QA/QC Engineer';
  var result = searchBiT33sByJobTitleForUser(jobTitle);
  console.log('Test result for QA/QC Engineer:', result);
  return result;
}

/**
 * Search bi_t33s table by job title (requirement_name from bi_t14s) for the logged-in user, with pagination
 * @param {string} jobTitle - Job title to search for
 * @param {number} [page=1] - Page number (1-based)
 * @param {number} [pageSize=5] - Number of records per page (default 5)
 * @return {Object} Result object with matching records and pagination info
 */
function searchBiT33sByJobTitleForUserPaginated(jobTitle, page, pageSize) {
  try {
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    if (!isLoggedIn || !userId) {
      return { success: false, message: 'User not logged in' };
    }
    if (!jobTitle || jobTitle.trim() === '') {
      return { success: false, message: 'Job title is required' };
    }

    // Defaults
    page = parseInt(page, 10) || 1;
    pageSize = parseInt(pageSize, 10) || 5;
    var offset = (page - 1) * pageSize;

    // Get user name info
    var firstName = props.getProperty('first_name');
    var lastName = props.getProperty('last_name');
    var userName = props.getProperty('userName');
    var actualFullName = (firstName + ' ' + lastName).trim() || userName || '';

    // Build WHERE clause for assignment
    var whereConditions = [];
    if (actualFullName && actualFullName !== 'null' && actualFullName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(actualFullName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(actualFullName)}%'`);
    } else if (firstName && firstName.trim() !== '') {
      whereConditions.push(`assign_to LIKE '%${sqlSafe(firstName)}%'`);
      whereConditions.push(`assign_to_others_1 LIKE '%${sqlSafe(firstName)}%'`);
      whereConditions.push(`assign_to_others_2 LIKE '%${sqlSafe(firstName)}%'`);
    }
    if (whereConditions.length === 0) {
      return { success: true, data: [], message: 'No name available for search' };
    }
    var whereClause = whereConditions.join(' OR ');

    // 1. Get bi_primary_id for this job title assigned to this user
    var jdQuery = `
      SELECT bi_primary_id
      FROM bi_t14s
      WHERE (${whereClause})
        AND requirement_status = 'Open'
        AND requirement_name = '${sqlSafe(jobTitle)}'
      LIMIT 1
    `;
    var jdResult = fetchFromAPI(jdQuery);
    var bi_primary_id = null;
    if (jdResult && Array.isArray(jdResult) && jdResult.length > 0) {
      var jdData = jdResult[0].bi_t14s || jdResult[0];
      bi_primary_id = jdData.bi_primary_id;
    } else if (jdResult && jdResult.status === 'success' && jdResult.data && jdResult.data.length > 0) {
      var jdData = jdResult.data[0].bi_t14s || jdResult.data[0];
      bi_primary_id = jdData.bi_primary_id;
    }
    if (!bi_primary_id) {
      return { success: true, data: [], message: 'No JD found for this job title and user' };
    }

    // 2. Get total count for pagination
    var countQuery = `
      SELECT COUNT(*) as total
      FROM bi_t33s
      WHERE job_id = '${sqlSafe(bi_primary_id)}'
    `;
    console.log('Count query:', countQuery);
    var countResult = fetchFromAPI(countQuery);
    console.log('Count result:', countResult);
    var totalCount = 0;
    
    // Handle different response formats for count
    if (countResult && Array.isArray(countResult) && countResult.length > 0) {
      // Handle nested array structure: [[{"total":"10"}]]
      if (countResult[0] && Array.isArray(countResult[0]) && countResult[0].length > 0) {
        totalCount = parseInt(countResult[0][0].total) || 0;
        console.log('Using nested array format for count:', totalCount);
      } else if (countResult[0] && countResult[0].total) {
        totalCount = parseInt(countResult[0].total) || 0;
        console.log('Using direct object format for count:', totalCount);
      } else if (countResult[0] && countResult[0].bi_t33s && countResult[0].bi_t33s.total) {
        totalCount = parseInt(countResult[0].bi_t33s.total) || 0;
        console.log('Using bi_t33s wrapper format for count:', totalCount);
      }
    } else if (countResult && countResult.status === 'success' && countResult.data && countResult.data.length > 0) {
      // Handle full response object format
      if (countResult.data[0] && Array.isArray(countResult.data[0]) && countResult.data[0].length > 0) {
        totalCount = parseInt(countResult.data[0][0].total) || 0;
        console.log('Using full response nested array format for count:', totalCount);
      } else if (countResult.data[0] && countResult.data[0].total) {
        totalCount = parseInt(countResult.data[0].total) || 0;
        console.log('Using full response direct object format for count:', totalCount);
      } else if (countResult.data[0] && countResult.data[0].bi_t33s && countResult.data[0].bi_t33s.total) {
        totalCount = parseInt(countResult.data[0].bi_t33s.total) || 0;
        console.log('Using full response bi_t33s wrapper format for count:', totalCount);
      }
    }
    
    console.log('Final total count:', totalCount);
    var totalPages = Math.ceil(totalCount / pageSize);

    // 3. Fetch paginated data from bi_t33s where job_id = bi_primary_id (only required columns)
    var sqlQuery = `
      SELECT 
        bi_primary_id,
        candidate_name,
        current_job_title,
        linkedin_link,
        education,
        email,
        location,
        skills,
        opentowork,
        current_company,
        current_position,
        current_company_startdate,
        current_company_enddate,
        previous_company,
        previous_position,
        previous_company_startdate,
        previous_company_enddate
      FROM bi_t33s
      WHERE job_id = '${sqlSafe(bi_primary_id)}'
      ORDER BY bi_primary_id DESC
      LIMIT ${offset}, ${pageSize}
    `;
    var result = fetchFromAPI(sqlQuery);
    var searchResults = [];
    if (result && result.status === 'success' && result.data && result.data.length > 0) {
      result.data.forEach(function(item) {
        var searchData = item.bi_t33s || item;
        if (searchData) {
          searchResults.push({
            id: searchData.bi_primary_id || 'N/A',
            candidateName: searchData.candidate_name || 'Not specified',
            currentJobTitle: searchData.current_job_title || 'Not specified',
            linkedinLink: searchData.linkedin_link || '',
            education: searchData.education || 'Not specified',
            email: searchData.email || 'Not specified',
            location: searchData.location || 'Not specified',
            skills: searchData.skills || 'Not specified',
            opentowork: searchData.opentowork || '0',
            currentCompany: searchData.current_company || 'Not specified',
            currentPosition: searchData.current_position || 'Not specified',
            currentCompanyStartdate: searchData.current_company_startdate || 'Not specified',
            currentCompanyEnddate: searchData.current_company_enddate || 'Not specified',
            previousCompany: searchData.previous_company || 'Not specified',
            previousPosition: searchData.previous_position || 'Not specified',
            previousCompanyStartdate: searchData.previous_company_startdate || 'Not specified',
            previousCompanyEnddate: searchData.previous_company_enddate || 'Not specified'
          });
        }
      });
    } else if (result && Array.isArray(result) && result.length > 0) {
      result.forEach(function(item) {
        var searchData = item.bi_t33s || item;
        if (searchData) {
          searchResults.push({
            id: searchData.bi_primary_id || 'N/A',
            candidateName: searchData.candidate_name || 'Not specified',
            currentJobTitle: searchData.current_job_title || 'Not specified',
            linkedinLink: searchData.linkedin_link || '',
            education: searchData.education || 'Not specified',
            email: searchData.email || 'Not specified',
            location: searchData.location || 'Not specified',
            skills: searchData.skills || 'Not specified',
            opentowork: searchData.opentowork || '0',
            currentCompany: searchData.current_company || 'Not specified',
            currentPosition: searchData.current_position || 'Not specified',
            currentCompanyStartdate: searchData.current_company_startdate || 'Not specified',
            currentCompanyEnddate: searchData.current_company_enddate || 'Not specified',
            previousCompany: searchData.previous_company || 'Not specified',
            previousPosition: searchData.previous_position || 'Not specified',
            previousCompanyStartdate: searchData.previous_company_startdate || 'Not specified',
            previousCompanyEnddate: searchData.previous_company_enddate || 'Not specified'
          });
        }
      });
    }
    return {
      success: true,
      data: searchResults,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalCount: totalCount,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      message: 'Found ' + searchResults.length + ' records for job title: ' + jobTitle
    };
  } catch (error) {
    return { success: false, data: [], message: 'Error searching database' };
  }
}

/**
 * Test function for searchBiT33sByJobTitleForUserPaginated with job title 'QA/QC Engineer', page 1, pageSize 5
 * Logs and returns the result.
 */
function testSearchBiT33sByJobTitleForUserPaginated_QAQCEngineer() {
  var jobTitle = 'QA/QC Engineer';
  var page = 1;
  var result = searchBiT33sByJobTitleForUserPaginated(jobTitle, page);
  console.log('Paginated test result for QA/QC Engineer (page 1):', result);
  return result;
}

/**
 * Test function to fetch specific columns from bi_t33s for job_id = '782'
 * @param {string} columns - Comma-separated list of columns to select (e.g. "bi_primary_id,candidate_name")
 * @return {Object} API result
 */
function testBiT33sSelectColumns(columns) {
  if (!columns || columns.trim() === '') {
    columns = 'candidate_name,current_job_title,linkedin_link'; // default
  }
  var sqlQuery = `SELECT ${columns} FROM bi_t33s WHERE job_id = '782' LIMIT 0, 5`;
  var result = fetchFromAPI(sqlQuery);
  console.log('Test columns:', columns, 'Result:', result);
  return result;
}

/**
 * Test function to debug count query for job_id = '782'
 * @return {Object} API result
 */
function testBiT33sCountQuery() {
  var countQuery = `SELECT COUNT(*) as total FROM bi_t33s WHERE job_id = '782'`;
  console.log('Testing count query:', countQuery);
  var result = fetchFromAPI(countQuery);
  console.log('Count query result:', result);
  console.log('Result type:', typeof result);
  console.log('Is array:', Array.isArray(result));
  if (result && Array.isArray(result)) {
    console.log('Array length:', result.length);
    if (result.length > 0) {
      console.log('First element:', result[0]);
      console.log('First element type:', typeof result[0]);
      console.log('Is first element array:', Array.isArray(result[0]));
    }
  }
  return result;
}



function testUpdateCandidateStatus() {
  // Replace with a real candidateId from your bi_t31s table
  var testCandidateId = '238'; // Example: use a real ID from your data
  var testStatuses = ['Shortlisted', 'Replied', 'Booked', 'No-show', 'Disqualified', 'Pending'];

  var results = [];
  for (var i = 0; i < testStatuses.length; i++) {
    var status = testStatuses[i];
    var result = updateCandidateStatus(testCandidateId, status);
    Logger.log('Test status: ' + status);
    Logger.log(result);
    results.push({status: status, result: result});
  }
  return results;
}

/**
 * Fetches unread notifications from bi_t34s table
 * @return {Object} Unread notification count and data
 */
function getNotifications() {
  try {
    var requestTime = getCurrentRequestTime();
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var userEmail = props.getProperty('email');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in, returning empty notifications');
      return { count: 0, notifications: [], notificationIds: [] };
    }
    
    console.log('User info - ID:', userId, 'Name:', userName, 'Email:', userEmail);
    
    // Get bi_primary_ids of jobs assigned to the current user (search in all assign_to columns)
    var jobQuery = `SELECT DISTINCT bi_primary_id FROM bi_t14s 
                    WHERE assign_to LIKE '%${sqlSafe(userName || userEmail)}%' 
                    OR assign_to_others_1 LIKE '%${sqlSafe(userName || userEmail)}%' 
                    OR assign_to_others_2 LIKE '%${sqlSafe(userName || userEmail)}%'`;
    console.log('Job assignment query:', jobQuery);
    
    var jobResult = fetchFromAPI(jobQuery);
    console.log('Job assignment result:', jobResult);
    
    var assignedJobPrimaryIds = [];
    
    if (jobResult && Array.isArray(jobResult) && jobResult.length > 0) {
      jobResult.forEach(function(item) {
        var jobData = null;
        if (item.bi_t14s) {
          jobData = item.bi_t14s;
        } else {
          jobData = item;
        }
        
        if (jobData && jobData.bi_primary_id) {
          assignedJobPrimaryIds.push(jobData.bi_primary_id);
        }
      });
    }
    
    console.log('Assigned job primary IDs for user', userId, ':', assignedJobPrimaryIds);
    
    if (assignedJobPrimaryIds.length === 0) {
      console.log('No jobs assigned to user, returning empty notifications');
      return { count: 0, notifications: [], notificationIds: [] };
    }
    
    // Build query to get notifications where bi_t34s.job_id matches bi_t14s.bi_primary_id
    var jobPrimaryIdsString = assignedJobPrimaryIds.join(',');
    var query = `SELECT bi_primary_id, notification, job_id, requirement_name, created_at 
                 FROM bi_t34s 
                 WHERE notification IS NOT NULL 
                 AND notification != '' 
                 AND read_status = 0 
                 AND job_id IN (${jobPrimaryIdsString})`;
    var endpoint = "apis/getQueryData/?request_time=" + requestTime;
    var url = buildApiUrl(endpoint);
    var xcode = generateXCode(endpoint);
    
    // Get current user email from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var userEmail = scriptProperties.getProperty('email');
    
    console.log('Notifications API URL:', url);
    console.log('Notifications Query:', query);
    console.log('User ID:', userId);
    console.log('User email:', userEmail);
    
    var options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        query: query,
        email: userEmail
      },
      headers: {
        "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
        "X-Code": xcode,
        "X-Request-Time": requestTime
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    
    console.log('Notifications raw response:', responseText);
    
    // Check if response is empty or invalid
    if (!responseText || responseText.trim() === '') {
      console.log('Empty response from notifications API');
      return { count: 0, notifications: [] };
    }
    
    // Parse JSON response
    var json;
    try {
      json = JSON.parse(responseText);
    } catch (e) {
      console.log('JSON parsing failed for notifications:', e);
      return { count: 0, notifications: [] };
    }
    
    // Handle different response formats
    var notifications = [];
    if (Array.isArray(json)) {
      notifications = json;
    } else if (json.data && Array.isArray(json.data)) {
      notifications = json.data;
    } else if (json.notification) {
      notifications = [json];
    }
    
    // Count non-empty notifications and collect IDs
    var count = 0;
    var validNotifications = [];
    var notificationIds = [];
    
    for (var i = 0; i < notifications.length; i++) {
      var notificationItem = notifications[i];
      var notification = null;
      
      // Handle nested structure where data is in bi_t34s object
      if (notificationItem.bi_t34s) {
        notification = notificationItem.bi_t34s;
      } else {
        notification = notificationItem;
      }
      
      if (notification && notification.notification && notification.notification.trim() !== '') {
        // Since we're querying for read_status = 0, if the notification exists, it's unread
        // Only check read_status if it exists in the response
        var isUnread = true;
        if (notification.read_status !== undefined) {
          isUnread = (notification.read_status === "0" || notification.read_status === 0);
        }
        
        if (isUnread) {
          count++;
          validNotifications.push(notification.notification);
          
          // Use bi_primary_id as the ID for marking as read
          if (notification.bi_primary_id) {
            notificationIds.push(notification.bi_primary_id);
          } else if (notification.id) {
            notificationIds.push(notification.id);
          }
        }
      }
    }
    
    console.log('Unread notifications count for user', userId, ':', count);
    console.log('Notifications:', validNotifications);
    console.log('Notification IDs:', notificationIds);
    
    return {
      count: count,
      notifications: validNotifications,
      notificationIds: notificationIds
    };
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { count: 0, notifications: [] };
  }
}

/**
 * Marks notifications as read by updating read_status to 1
 * @param {Array} notificationIds - Array of notification IDs to mark as read
 * @return {Object} Success status and updated count
 */
function markNotificationsAsRead(notificationIds) {
  try {
    if (!notificationIds || notificationIds.length === 0) {
      console.log('No notification IDs provided to mark as read');
      return { success: true, message: 'No notifications to mark as read' };
    }
    
    var requestTime = getCurrentRequestTime();
    
    // Create UPDATE query for multiple IDs (using bi_primary_id)
    var idsString = notificationIds.join(',');
    var query = "UPDATE bi_t34s SET read_status = 1 WHERE bi_primary_id IN (" + idsString + ")";
    
    var endpoint = "apis/getQueryData/?request_time=" + requestTime;
    var url = buildApiUrl(endpoint);
    var xcode = generateXCode(endpoint);
    
    // Get current user email from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var userEmail = scriptProperties.getProperty('email');
    
    console.log('Mark as read API URL:', url);
    console.log('Mark as read Query:', query);
    console.log('User email:', userEmail);
    console.log('Notification IDs to mark as read:', notificationIds);
    
    var options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        query: query,
        email: userEmail
      },
      headers: {
        "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
        "X-Code": xcode,
        "X-Request-Time": requestTime
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    
    console.log('Mark as read raw response:', responseText);
    
    // Check if response indicates success
    if (response.getResponseCode() === 200) {
      console.log('Successfully marked notifications as read');
      return { 
        success: true, 
        message: 'Notifications marked as read',
        updatedCount: notificationIds.length
      };
    } else {
      console.log('Failed to mark notifications as read');
      return { 
        success: false, 
        message: 'Failed to mark notifications as read',
        error: responseText
      };
    }
    
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return { 
      success: false, 
      message: 'Error marking notifications as read',
      error: error.toString()
    };
  }
}

/**
 * Debug function to check what data exists in bi_t34s table
 * @return {Object} Table data for debugging
 */
function debugBiT34sTable() {
  try {
    var requestTime = getCurrentRequestTime();
    var query = "SELECT * FROM bi_t34s LIMIT 10";
    var endpoint = "apis/getQueryData/?request_time=" + requestTime;
    var url = buildApiUrl(endpoint);
    var xcode = generateXCode(endpoint);
    
    // Get current user email from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var userEmail = scriptProperties.getProperty('email');
    
    console.log('Debug API URL:', url);
    console.log('Debug Query:', query);
    console.log('User email:', userEmail);
    
    var options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        query: query,
        email: userEmail
      },
      headers: {
        "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
        "X-Code": xcode,
        "X-Request-Time": requestTime
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    
    console.log('Debug raw response:', responseText);
    
    // Parse JSON response
    var json;
    try {
      json = JSON.parse(responseText);
    } catch (e) {
      console.log('JSON parsing failed for debug:', e);
      return { error: 'JSON parsing failed', rawResponse: responseText };
    }
    
    console.log('Debug parsed JSON:', json);
    
    return {
      success: true,
      data: json,
      rawResponse: responseText
    };
    
  } catch (error) {
    console.error('Error in debug function:', error);
    return { 
      success: false, 
      error: error.toString()
    };
  }
}

/**
 * Test function to insert sample notifications for testing
 * @return {Object} Insert result
 */
function insertTestNotifications() {
  try {
    var requestTime = getCurrentRequestTime();
    
    // Get current user info
    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var userEmail = props.getProperty('email');
    
    if (!userId) {
      return { success: false, message: 'User not logged in' };
    }
    
    console.log('Inserting notifications for user:', userId, '(', userName || userEmail, ')');
    
    // First, get a bi_primary_id that is assigned to this user (search in all assign_to columns)
    var jobQuery = `SELECT bi_primary_id FROM bi_t14s 
                    WHERE assign_to LIKE '%${sqlSafe(userName || userEmail)}%' 
                    OR assign_to_others_1 LIKE '%${sqlSafe(userName || userEmail)}%' 
                    OR assign_to_others_2 LIKE '%${sqlSafe(userName || userEmail)}%' 
                    LIMIT 1`;
    var jobResult = fetchFromAPI(jobQuery);
    var jobId = 'TEST-JOB-001'; // Default test job ID
    
    if (jobResult && Array.isArray(jobResult) && jobResult.length > 0) {
      var jobData = jobResult[0].bi_t14s || jobResult[0];
      if (jobData && jobData.bi_primary_id) {
        jobId = jobData.bi_primary_id; // Use bi_primary_id as job_id for notifications
      }
    }
    
    console.log('Using bi_primary_id as job_id for test notifications:', jobId);
    
    // Insert test notifications for assigned job
    var queries = [
      `INSERT INTO bi_t34s (notification, read_status, job_id, created_at) VALUES ('New job application received for React Developer position', 0, '${sqlSafe(jobId)}', '${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}')`,
      `INSERT INTO bi_t34s (notification, read_status, job_id, created_at) VALUES ('Interview scheduled for tomorrow at 2:00 PM', 0, '${sqlSafe(jobId)}', '${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}')`,
      `INSERT INTO bi_t34s (notification, read_status, job_id, created_at) VALUES ('Candidate profile updated - John Doe', 0, '${sqlSafe(jobId)}', '${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}')`
    ];
    
    var results = [];
    
    for (var i = 0; i < queries.length; i++) {
      var query = queries[i];
      var endpoint = "apis/getQueryData/?request_time=" + requestTime;
      var url = buildApiUrl(endpoint);
      var xcode = generateXCode(endpoint);
      
      // Get current user email from script properties
      var scriptProperties = PropertiesService.getScriptProperties();
      var userEmail = scriptProperties.getProperty('email');
      
      console.log('Insert API URL:', url);
      console.log('Insert Query:', query);
      console.log('User email:', userEmail);
      
      var options = {
        method: "post",
        contentType: "application/x-www-form-urlencoded",
        payload: {
          query: query,
          email: userEmail
        },
        headers: {
          "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
          "X-Code": xcode,
          "X-Request-Time": requestTime
        },
        muteHttpExceptions: true
      };
      
      var response = UrlFetchApp.fetch(url, options);
      var responseText = response.getContentText();
      
      console.log('Insert response:', responseText);
      
      results.push({
        query: query,
        response: responseText,
        statusCode: response.getResponseCode()
      });
    }
    
    return {
      success: true,
      results: results
    };
    
  } catch (error) {
    console.error('Error inserting test notifications:', error);
    return { 
      success: false, 
      error: error.toString()
    };
  }
}

/**
 * Test function to check database connectivity and table structure
 * @return {Object} Test results
 */
function testDatabaseConnection() {
  try {
    console.log('=== TESTING DATABASE CONNECTION ===');
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var userEmail = props.getProperty('email');
    
    console.log('User email:', userEmail);
    
    // Test 1: Simple SELECT query to check if bi_t14s table exists
    var testQuery = "SELECT COUNT(*) as total FROM bi_t14s LIMIT 1";
    console.log('Test query:', testQuery);
    
    var result = fetchFromAPI(testQuery);
    console.log('Query result:', JSON.stringify(result));
    
    // Test 2: Check table structure
    var structureQuery = "DESCRIBE bi_t14s";
    console.log('Structure query:', structureQuery);
    
    var structureResult = fetchFromAPI(structureQuery);
    console.log('Table structure:', JSON.stringify(structureResult));
    
    return {
      success: true,
      message: 'Database connection test completed',
      selectTest: result,
      structureTest: structureResult
    };
  } catch (error) {
    console.error('Database test error:', error);
    return {
      success: false,
      message: 'Database test failed: ' + error.toString()
    };
  }
}

/**
 * Test function to check new database connection function
 * @return {Object} Test results
 */
function testNewDatabaseConnection() {
  try {
    console.log('=== TESTING NEW DATABASE CONNECTION ===');
    
    // Create database connection
    var dbConnection = createDatabaseConnection();
    
    if (!dbConnection.success && dbConnection.error) {
      console.error('Failed to create database connection:', dbConnection.error);
      return {
        success: false,
        message: 'Database connection failed: ' + dbConnection.error
      };
    }
    
    // Test 1: Simple SELECT query to check if bi_t14s table exists
    var testQuery = "SELECT COUNT(*) as total FROM bi_t14s LIMIT 1";
    console.log('Test query:', testQuery);
    
    var result = dbConnection.execute(testQuery);
    console.log('Query result:', JSON.stringify(result));
    
    // Test 2: Check table structure
    var structureQuery = "DESCRIBE bi_t14s";
    console.log('Structure query:', structureQuery);
    
    var structureResult = dbConnection.execute(structureQuery);
    console.log('Table structure:', JSON.stringify(structureResult));
    
    // Close connection
    dbConnection.close();
    
    return {
      success: true,
      message: 'New database connection test completed',
      selectTest: result,
      structureTest: structureResult
    };
  } catch (error) {
    console.error('New database test error:', error);
    return {
      success: false,
      message: 'New database test failed: ' + error.toString()
    };
  }
}

/**
 * Test function to test two-step insert approach
 * First inserts basic data, then updates with additional fields
 * @return {Object} Result of the two-step test
 */
function testTwoStepInsert() {
  try {
    console.log('=== TESTING TWO-STEP INSERT APPROACH ===');
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userEmail = props.getProperty('email');
    var userName = props.getProperty('userName');
    
    if (!isLoggedIn || !userId) {
      return { success: false, message: 'User not logged in' };
    }
    
    var requestTime = getCurrentRequestTime();
    var endpoint = "apis/getQueryData/?request_time=" + requestTime;
    var url = buildApiUrl(endpoint);
    var xcode = generateXCode(endpoint);
    var currentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Test data
    var testJobTitle = 'TEST Two-Step Insert - ' + new Date().getTime();
    var testClientName = 'Test Client Corp';
    
    console.log('Step 1: Basic insert with minimal fields...');
    
    // Step 1: Basic insert with minimal fields (known to work)
    var basicInsertQuery = `INSERT INTO bi_t14s (
      requirement_name, 
      client_name, 
      requirement_received_date, 
      open_no_of_position, 
      experince_range, 
      mandatory_skills, 
      job_location, 
      type_of_position, 
      requirement_status, 
      note, 
      Manager, 
      responsibilities,
      created_by, 
      created_at
    ) VALUES (
      '${sqlSafe(testJobTitle)}', 
      '${sqlSafe(testClientName)}', 
      '${currentDate}', 
      1, 
      '3-5 years', 
      'JavaScript, Python, SQL', 
      'Bangalore', 
      'New Project', 
      'Open', 
      'Test requirement for two-step insert', 
      'Test Manager', 
      'Test job description for two-step approach',
      ${parseInt(userId)}, 
      '${currentDate}'
    )`;
    
    console.log('Basic insert query:', basicInsertQuery);
    
    var options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        query: basicInsertQuery,
        email: userEmail
      },
      headers: {
        "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
        "X-Code": xcode,
        "X-Request-Time": requestTime
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    var responseCode = response.getResponseCode();
    
    console.log('Basic insert response code:', responseCode);
    console.log('Basic insert response text:', responseText);
    
    var jsonResponse = null;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.log('Response is not JSON:', parseError);
    }
    
    if (responseCode >= 200 && responseCode < 300 && jsonResponse && jsonResponse.status !== 'error') {
      console.log('✅ Step 1 SUCCESS: Basic insert worked!');
      
      console.log('Step 2: Update with additional fields...');
      
      // Step 2: Update with additional fields
      var updateQuery = `UPDATE bi_t14s SET 
        date_of_allocation = '2025-01-20',
        jd_received = 'Yes',
        relevant_exp = '3+ years in web development',
        any_qualification_criteria = 'B.Tech or equivalent',
        shift_details = 'Day Shift (9:30 AM - 6:30 PM)',
        salary_bracket = '8-12 LPA',
        onsite_opportunity = 'No',
        does_the_profile_invovle_travelling = 'Yes',
        specific_gender_requirement = 'No Preference',
        process_of_interview = 'Round 1: Technical | Round 2: Manager',
        requirement_open_since = '1 week',
        if_new_project = 'Received',
        requirement_close_date = '2025-03-15',
        team_leader = 'John Doe',
        due_date = '2025-02-28',
        lead_ref_number = 'REF-001',
        assign_to = '${sqlSafe(userName || userEmail)}',
        mark_complete_once_all_fulfilled = 'In Progress',
        past_company = 'Previous Company Inc'
        WHERE requirement_name = '${sqlSafe(testJobTitle)}' 
        AND created_by = ${parseInt(userId)} 
        AND created_at = '${currentDate}'`;
      
      console.log('Update query:', updateQuery);
      
      var updateOptions = {
        method: "post",
        contentType: "application/x-www-form-urlencoded",
        payload: {
          query: updateQuery,
          email: userEmail
        },
        headers: {
          "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
          "X-Code": xcode,
          "X-Request-Time": requestTime
        },
        muteHttpExceptions: true
      };
      
      var updateResponse = UrlFetchApp.fetch(url, updateOptions);
      var updateResponseText = updateResponse.getContentText();
      var updateResponseCode = updateResponse.getResponseCode();
      
      console.log('Update response code:', updateResponseCode);
      console.log('Update response text:', updateResponseText);
      
      if (updateResponseCode >= 200 && updateResponseCode < 300) {
        try {
          var updateJsonResponse = JSON.parse(updateResponseText);
          if (updateJsonResponse && updateJsonResponse.status === 'error') {
            console.log('❌ Step 2 FAILED: Update failed -', updateJsonResponse.msg);
            return {
              success: true,
              message: 'Two-step test completed: Basic insert succeeded, but update failed',
              step1Success: true,
              step2Success: false,
              step2Error: updateJsonResponse.msg,
              testJobTitle: testJobTitle
            };
          } else {
            console.log('✅ Step 2 SUCCESS: Update worked!');
            return {
              success: true,
              message: 'Two-step test completed successfully! Both insert and update worked.',
              step1Success: true,
              step2Success: true,
              testJobTitle: testJobTitle
            };
          }
        } catch (updateParseError) {
          console.log('❌ Step 2 FAILED: Update response is not JSON -', updateParseError);
          return {
            success: true,
            message: 'Two-step test completed: Basic insert succeeded, but update response invalid',
            step1Success: true,
            step2Success: false,
            step2Error: 'Invalid JSON response',
            testJobTitle: testJobTitle
          };
        }
      } else {
        console.log('❌ Step 2 FAILED: Update failed with response code', updateResponseCode);
        return {
          success: true,
          message: 'Two-step test completed: Basic insert succeeded, but update failed',
          step1Success: true,
          step2Success: false,
          step2Error: 'HTTP ' + updateResponseCode,
          testJobTitle: testJobTitle
        };
      }
      
    } else {
      console.log('❌ Step 1 FAILED: Basic insert failed');
      return {
        success: false,
        message: 'Two-step test failed: Basic insert failed',
        step1Success: false,
        step2Success: false,
        step1Error: jsonResponse ? jsonResponse.msg : 'Unknown error'
      };
    }
    
  } catch (error) {
    console.error('Error in two-step insert test:', error);
    return {
      success: false,
      error: error.toString(),
      message: 'Two-step test failed with exception'
    };
  }
}

/**
 * Test function to check available API endpoints
 * Tests different endpoint variations to find the correct one for INSERT operations
 * @return {Object} Result of the endpoint tests
 */
function testAPIEndpoints() {
  try {
    console.log('=== TESTING API ENDPOINTS ===');
    
    var requestTime = getCurrentRequestTime();
    var testQuery = "SELECT 1 as test";
    var userEmail = PropertiesService.getScriptProperties().getProperty('email');
    
    // List of potential endpoints to test
    var endpoints = [
      "apis/getQueryData/",
      "apis/insertData/", 
      "apis/updateData/",
      "apis/executeQuery/",
      "apis/runQuery/",
      "apis/query/",
      "apis/data/",
      "apis/sql/"
    ];
    
    var results = [];
    
    endpoints.forEach(function(endpoint) {
      try {
        console.log('Testing endpoint:', endpoint);
        
        var url = buildApiUrl(endpoint + "?request_time=" + requestTime);
        var xcode = generateXCode(endpoint + "?request_time=" + requestTime);
        
        var options = {
          method: "post",
          contentType: "application/x-www-form-urlencoded",
          payload: {
            query: testQuery,
            email: userEmail
          },
          headers: {
            "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
            "X-Code": xcode,
            "X-Request-Time": requestTime
          },
          muteHttpExceptions: true
        };
        
        var response = UrlFetchApp.fetch(url, options);
        var responseCode = response.getResponseCode();
        var responseText = response.getContentText();
        
        results.push({
          endpoint: endpoint,
          statusCode: responseCode,
          success: responseCode >= 200 && responseCode < 300,
          response: responseText.substring(0, 200) // First 200 chars only
        });
        
        console.log(`Endpoint ${endpoint}: Status ${responseCode}`);
        
      } catch (error) {
        results.push({
          endpoint: endpoint,
          statusCode: 'ERROR',
          success: false,
          error: error.toString()
        });
        console.log(`Endpoint ${endpoint}: ERROR - ${error.toString()}`);
      }
    });
    
    console.log('=== ENDPOINT TEST RESULTS ===');
    console.log(JSON.stringify(results, null, 2));
    
    return {
      success: true,
      results: results,
      message: 'Endpoint testing completed. Check console for details.'
    };
    
  } catch (error) {
    console.error('Error testing endpoints:', error);
    return {
      success: false,
      error: error.toString(),
      message: 'Failed to test endpoints'
    };
  }
}

/**
 * Test function to insert a sample requirement
 * Tests all fields including newly added ones:
 * - due_date
 * - lead_ref_number
 * - jd_received
 * - on_site_opportunity
 * - involve_traveling
 * @return {Object} Test result with success status and verification data
 */
function testPostRequirement() {
  try {
    console.log('=== TESTING POST REQUIREMENT ===');
    console.log('Testing with all required and optional fields...');
    
    // Create comprehensive sample form data matching the actual form structure
    var testFormData = {
      // Basic Information
      jobTitle: 'TEST - Senior Full Stack Developer',
      clientName: 'Tech Innovations Corp',
      
      // Date Fields
      requirementReceivedDate: '2025-01-15',
      dueDate: '2025-02-28',
      dateOfAllocation: '2025-01-20',
      requirementCloseDate: '2025-03-15',
      
      // Reference and Management
      leadRefNumber: 'LRN-2025-001',
      teamLeader: '',  // Will be populated from dropdown
      manager: 'Michael Chen',
      
      // Location and Employment Details
      location: 'Bangalore, India',
      employmentType: 'Full-time',
      typeOfPosition: 'New Project',
      
      // Experience and Qualification
      experienceLevel: '5-8 years',
      relevantExp: '5+ years in Full Stack Development with React and Node.js',
      qualification: 'B.Tech/B.E in Computer Science or related field',
      
      // Positions and Compensation
      positions: '3',
      salaryBracket: '15-20 LPA',
      
      // Work Details
      shift: 'Day Shift (9:30 AM - 6:30 PM)',
      specificGenderRequirement: 'No Preference',
      
      // Status and Project Information
      requirementStatus: 'Open',
      newProject: 'Received',
      markCompleteOnceAllFulfilled: 'In Progress',
      requirementOpenSince: '1 week',
      
      // New Yes/No Fields
      jdReceived: 'Yes',
      onSiteOpportunity: 'No',
      involveTraveling: 'Yes',
      
      // Technical Requirements
      skills: 'React.js, Node.js, Express.js, MongoDB, PostgreSQL, REST APIs, GraphQL, AWS, Docker, Kubernetes, CI/CD, Git',
      
      // Detailed Description
      jobDescription: 'We are looking for an experienced Full Stack Developer to join our growing team. ' +
                     'The ideal candidate will have strong experience in both frontend and backend development, ' +
                     'with expertise in modern JavaScript frameworks and cloud technologies. ' +
                     'This is a TEST requirement for debugging and verification purposes.',
      
      // Interview Process
      processOfInterview: 'Round 1: Screening (30min) | Round 2: Technical (90min) | Round 3: Design (60min) | Round 4: Manager (45min) | Round 5: HR (30min)',
      
      // Additional Notes
      additionalNotes: 'TEST requirement with all new fields: Due Date, Lead Ref, JD Received, On-Site, Traveling'
    };
    
    console.log('Test form data prepared with', Object.keys(testFormData).length, 'fields');
    console.log('Form data:', JSON.stringify(testFormData, null, 2));
    
    // Call the actual postRequirement function
    console.log('Calling postRequirement function...');
    var result = postRequirement(testFormData);
    
    console.log('Post requirement result:', JSON.stringify(result, null, 2));
    
    // If successful, verify it was inserted
    if (result && result.success) {
      console.log('✓ Requirement posted successfully!');
      console.log('Verifying insertion in database...');
      
      var verifyResult = testCheckRecentRequirements();
      console.log('Verification result:', JSON.stringify(verifyResult, null, 2));
      result.verification = verifyResult;
      
      console.log('=== TEST COMPLETED SUCCESSFULLY ===');
    } else {
      console.log('✗ Requirement posting failed');
      console.log('Error:', result ? result.message : 'Unknown error');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Test post requirement error:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      message: 'Test failed: ' + error.toString(),
      error: error.stack
    };
  }
}

/**
 * Simple test to insert minimal data
 * Tests if basic INSERT operations are allowed by the API
 * @return {Object} Test result
 */
function testSimpleInsert() {
  try {
    console.log('=== TESTING SIMPLE INSERT ===');
    
    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('user_id');
    var userEmail = props.getProperty('email');
    var userName = props.getProperty('userName');
    
    console.log('User ID:', userId);
    console.log('User Email:', userEmail);
    console.log('User Name:', userName);
    
    // Very simple insert with minimal required columns (only 4 fields)
    var currentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var simpleQuery = `INSERT INTO bi_t14s (requirement_name, client_name, created_by, created_at) VALUES ('TEST Simple Insert v3', 'Test Client Inc', ${parseInt(userId)}, '${currentDate}')`;
    
    console.log('Simple insert query:', simpleQuery);
    
    var result = fetchFromAPI(simpleQuery);
    console.log('Simple insert result:', JSON.stringify(result));
    
    // Check if it worked
    if (result && result.status === 'error') {
      console.log('INSERT was blocked by API:', result.msg);
      return {
        success: false,
        message: 'API blocked INSERT: ' + result.msg,
        result: result
      };
    } else if (result === true || result === null || (result && Object.keys(result).length === 0)) {
      console.log('INSERT appears successful (empty or true response)');
      return {
        success: true,
        message: 'Simple insert completed successfully',
        result: result
      };
    } else {
      return {
        success: true,
        message: 'Simple insert test completed',
        result: result
      };
    }
  } catch (error) {
    console.error('Simple insert test error:', error);
    return {
      success: false,
      message: 'Simple insert test failed: ' + error.toString()
    };
  }
}

/**
 * Test function to check recent entries in bi_t14s
 * @return {Object} Recent entries
 */
function testCheckRecentRequirements() {
  try {
    console.log('=== CHECKING RECENT REQUIREMENTS ===');
    
    var query = "SELECT * FROM bi_t14s ORDER BY created_at DESC LIMIT 5";
    console.log('Query:', query);
    
    var result = fetchFromAPI(query);
    console.log('Recent requirements:', JSON.stringify(result));
    
    return {
      success: true,
      data: result,
      count: result ? result.length : 0
    };
  } catch (error) {
    console.error('Check recent requirements error:', error);
    return {
      success: false,
      message: 'Failed to check recent requirements: ' + error.toString()
    };
  }
}

/**
 * Test inserting requirement with incremental columns to find problematic field
 * @return {Object} Test results
 */
function testIncrementalInsert() {
  try {
    console.log('=== TESTING INCREMENTAL INSERT ===');
    
    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var currentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    var results = [];
    
    // Test 1: Minimal columns (we know this works)
    var query1 = `INSERT INTO bi_t14s (requirement_name, client_name, created_by, created_at) VALUES ('TEST-INC-1', 'Client 1', ${parseInt(userId)}, '${currentDate}')`;
    var result1 = fetchFromAPI(query1);
    results.push({test: 'Minimal', query: query1, result: result1, success: result1 === true || (result1 && result1.status !== 'error')});
    
    // Test 2: Add a few more columns
    var query2 = `INSERT INTO bi_t14s (requirement_name, client_name, requirement_received_date, job_location, created_by, created_at) VALUES ('TEST-INC-2', 'Client 2', '2025-01-15', 'Bangalore', ${parseInt(userId)}, '${currentDate}')`;
    var result2 = fetchFromAPI(query2);
    results.push({test: 'Basic fields', query: query2, result: result2, success: result2 === true || (result2 && result2.status !== 'error')});
    
    // Test 3: Add ENUM columns
    var query3 = `INSERT INTO bi_t14s (requirement_name, client_name, type_of_position, requirement_status, created_by, created_at) VALUES ('TEST-INC-3', 'Client 3', 'New Project', 'Open', ${parseInt(userId)}, '${currentDate}')`;
    var result3 = fetchFromAPI(query3);
    results.push({test: 'With ENUMs', query: query3, result: result3, success: result3 === true || (result3 && result3.status !== 'error')});
    
    // Test 4: Add text columns
    var query4 = `INSERT INTO bi_t14s (requirement_name, client_name, mandatory_skills, responsibilities, created_by, created_at) VALUES ('TEST-INC-4', 'Client 4', 'Java, Python', 'Test job description', ${parseInt(userId)}, '${currentDate}')`;
    var result4 = fetchFromAPI(query4);
    results.push({test: 'With TEXT fields', query: query4, result: result4, success: result4 === true || (result4 && result4.status !== 'error')});
    
    console.log('Incremental test results:', JSON.stringify(results));
    
    return {
      success: true,
      message: 'Incremental tests completed',
      results: results
    };
  } catch (error) {
    console.error('Incremental test error:', error);
    return {
      success: false,
      message: 'Incremental test failed: ' + error.toString()
    };
  }
}

/**
 * Comprehensive debug function - runs all tests
 * @return {Object} All test results
 */
function debugPostRequirementSystem() {
  try {
    console.log('\n\n========================================');
    console.log('COMPREHENSIVE POST REQUIREMENT DEBUG');
    console.log('========================================\n');
    
    var debugResults = {};
    
    // Test 1: Check user session
    console.log('\n--- TEST 1: USER SESSION ---');
    var props = PropertiesService.getScriptProperties();
    var sessionData = {
      isLoggedIn: props.getProperty('isLoggedIn'),
      userId: props.getProperty('user_id'),
      userEmail: props.getProperty('email'),
      userName: props.getProperty('userName')
    };
    console.log('Session data:', JSON.stringify(sessionData));
    debugResults.session = sessionData;
    
    // Test 2: Database connection
    console.log('\n--- TEST 2: DATABASE CONNECTION ---');
    var dbTest = testDatabaseConnection();
    console.log('Database test result:', JSON.stringify(dbTest));
    debugResults.databaseConnection = dbTest;
    
    // Test 3: Simple insert
    console.log('\n--- TEST 3: SIMPLE INSERT ---');
    var simpleInsert = testSimpleInsert();
    console.log('Simple insert result:', JSON.stringify(simpleInsert));
    debugResults.simpleInsert = simpleInsert;
    
    // Test 4: Full requirement post
    console.log('\n--- TEST 4: FULL REQUIREMENT POST ---');
    var fullPost = testPostRequirement();
    console.log('Full post result:', JSON.stringify(fullPost));
    debugResults.fullPost = fullPost;
    
    // Test 5: Check recent requirements
    console.log('\n--- TEST 5: RECENT REQUIREMENTS CHECK ---');
    var recentCheck = testCheckRecentRequirements();
    console.log('Recent requirements:', JSON.stringify(recentCheck));
    debugResults.recentRequirements = recentCheck;
    
    console.log('\n========================================');
    console.log('DEBUG SUMMARY');
    console.log('========================================');
    console.log('Session Valid:', sessionData.isLoggedIn === 'true');
    console.log('Database Connection:', dbTest.success);
    console.log('Simple Insert:', simpleInsert.success);
    console.log('Full Post:', fullPost.success);
    console.log('Recent Count:', recentCheck.count);
    console.log('========================================\n');
    
    return {
      success: true,
      message: 'Debug completed - check logs for details',
      results: debugResults
    };
  } catch (error) {
    console.error('Debug system error:', error);
    return {
      success: false,
      message: 'Debug failed: ' + error.toString()
    };
  }
}

/**
 * Get team leaders from users table
 * @return {Object} Result with team leaders list
 */
function getTeamLeaders() {
  try {
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    
    if (!isLoggedIn) {
      return { success: false, message: 'Not logged in' };
    }
    
    var query = "SELECT CONCAT_WS(' ',first_name,last_name) AS fullname FROM users WHERE role=5 AND status='1'";
    var result = fetchFromAPI(query);
    var teamLeaders = [];
    
    if (result && Array.isArray(result) && result.length > 0) {
      result.forEach(function(item) {
        // Handle nested array: [[{fullname}]]
        var userData = null;
        if (Array.isArray(item) && item.length > 0) {
          userData = item[0];
        } else {
          userData = item.users || item;
        }
        
        if (userData && userData.fullname) {
          teamLeaders.push(userData.fullname.trim());
        }
      });
    }
    
    return {
      success: true,
      data: teamLeaders,
      count: teamLeaders.length
    };
  } catch (error) {
    console.error('Error getting team leaders:', error);
    return { success: false, data: [], error: error.toString() };
  }
}

/**
 * Get all client names from bi_t8s table for dropdown
 * @return {Object} Result object with client names array
 */
function getClientNames() {
  try {
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    
    if (!isLoggedIn) {
      return { success: false, message: 'Not logged in' };
    }
    
    var query = "SELECT DISTINCT client_name FROM bi_t8s WHERE client_name IS NOT NULL AND client_name != '' ORDER BY client_name ASC";
    var result = fetchFromAPI(query);
    var clientNames = [];
    
    if (result && Array.isArray(result) && result.length > 0) {
      result.forEach(function(item) {
        // Handle nested array: [[{client_name}]]
        var clientData = null;
        if (Array.isArray(item) && item.length > 0) {
          clientData = item[0];
        } else {
          clientData = item.bi_t8s || item;
        }
        
        if (clientData && clientData.client_name) {
          clientNames.push(clientData.client_name.trim());
        }
      });
    }
    
    return {
      success: true,
      data: clientNames,
      count: clientNames.length
    };
  } catch (error) {
    console.error('Error getting client names:', error);
    return { success: false, data: [], error: error.toString() };
  }
}

/**
 * Get all managers from users table for dropdown
 * @return {Object} Result object with manager names array
 */
function getManagers() {
  try {
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    
    if (!isLoggedIn) {
      return { success: false, message: 'Not logged in' };
    }
    
    var query = "SELECT CONCAT_WS(' ', first_name, last_name) as fullname FROM users WHERE role = 5 AND status = '1' ORDER BY fullname ASC";
    console.log('Managers query:', query);
    
    var result = fetchFromAPI(query);
    console.log('Managers API result:', result);
    
    var managers = [];
    
    if (result && Array.isArray(result) && result.length > 0) {
      result.forEach(function(item) {
        // Handle nested array: [[{fullname}]]
        var managerData = null;
        if (Array.isArray(item) && item.length > 0) {
          managerData = item[0];
        } else {
          managerData = item.users || item;
        }
        
        if (managerData && managerData.fullname) {
          managers.push(managerData.fullname.trim());
        }
      });
    } else if (result && result.status === 'success' && result.data && result.data.length > 0) {
      result.data.forEach(function(item) {
        var managerData = item.users || item;
        if (managerData && managerData.fullname) {
          managers.push(managerData.fullname.trim());
        }
      });
    }
    
    console.log('Found managers:', managers);
    
    return {
      success: true,
      data: managers,
      count: managers.length
    };
  } catch (error) {
    console.error('Error getting managers:', error);
    return { success: false, data: [], error: error.toString() };
  }
}

/**
 * Get SPOC users from users table
 * @return {Object} Result object with SPOC names array
 */
function getSPOCUsers() {
  try {
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    
    if (!isLoggedIn) {
      return { success: false, message: 'Not logged in' };
    }
    
    var query = "SELECT CONCAT_WS(' ', first_name, last_name) as fullname FROM users WHERE role = 3 AND status = '1' ORDER BY fullname ASC";
    console.log('SPOC users query:', query);
    
    var result = fetchFromAPI(query);
    console.log('SPOC users API result:', result);
    
    var spocUsers = [];
    
    if (result && Array.isArray(result) && result.length > 0) {
      result.forEach(function(item) {
        // Handle nested array: [[{fullname}]]
        var userData = null;
        if (Array.isArray(item) && item.length > 0) {
          userData = item[0];
        } else {
          userData = item.users || item;
        }
        
        if (userData && userData.fullname) {
          spocUsers.push(userData.fullname.trim());
        }
      });
    } else if (result && result.status === 'success' && result.data && result.data.length > 0) {
      result.data.forEach(function(item) {
        var userData = item.users || item;
        if (userData && userData.fullname) {
          spocUsers.push(userData.fullname.trim());
        }
      });
    }
    
    console.log('Found SPOC users:', spocUsers);
    
    return {
      success: true,
      data: spocUsers,
      count: spocUsers.length
    };
  } catch (error) {
    console.error('Error getting SPOC users:', error);
    return { success: false, data: [], error: error.toString() };
  }
}

/**
 * Test function for team leaders
 */
function testGetTeamLeaders() {
  var result = getTeamLeaders();
  console.log('TEST RESULT:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Test function for SPOC users
 */
function testGetSPOCUsers() {
  console.log('=== TESTING getSPOCUsers FUNCTION ===');
  var result = getSPOCUsers();
  console.log('SPOC USERS TEST RESULT:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Test function for managers
 */
function testGetManagers() {
  try {
    var result = getManagers();
    console.log('Test managers result:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('Test managers error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Call LinkedIn webhook when requirement is posted with LinkedIn checkbox selected
 * @param {Object} formData - Form data containing requirement details
 * @return {Object} Result object with webhook response
 */
function callLinkedInWebhook(formData) {
  try {
    console.log('=== CALLING LINKEDIN WEBHOOK ===');
    console.log('Form data for webhook:', formData);
    
    // Get current user data
    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('user_id');
    var userName = props.getProperty('userName');
    var userEmail = props.getProperty('email');
    
    // Prepare webhook payload - Only requested fields
    var webhookPayload = {
      requirementName: formData.jobTitle || '',
      clientName: formData.clientName || '',
      location: formData.location || '',
      experienceLevel: formData.experienceLevel || '',
      positions: formData.positions || '',
      skills: formData.skills || '',
      jobDescription: formData.jobDescription || '',
      Qualification: formData.qualification || '',
      OnSiteOpportunity: formData.onSiteOpportunity || '',
      submittedBy: userName || userEmail || 'Unknown',
      submittedAt: new Date().toISOString(),
      source: 'iQuest Production Portal',
      salaryBracket: formData.salaryBracket || ''
    };
    
    console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));
    
    // Webhook URL
    var webhookUrl = "http://automation.teamob.io:5678/webhook/d325e149-ad09-4413-bfbc-ee18b34acdd9";
    
    var options = {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(webhookPayload),
      muteHttpExceptions: true
    };
    
    console.log('Calling webhook URL:', webhookUrl);
    console.log('Webhook options:', JSON.stringify(options, null, 2));
    
    var response = UrlFetchApp.fetch(webhookUrl, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    console.log('Webhook response code:', responseCode);
    console.log('Webhook response text:', responseText);
    
    if (responseCode >= 200 && responseCode < 300) {
      console.log('Webhook called successfully');
      return {
        success: true,
        message: 'LinkedIn webhook called successfully',
        responseCode: responseCode,
        response: responseText
      };
    } else {
      console.log('Webhook returned error code:', responseCode);
      return {
        success: false,
        message: 'LinkedIn webhook returned error: ' + responseCode,
        responseCode: responseCode,
        response: responseText
      };
    }
    
  } catch (error) {
    console.error('Error calling LinkedIn webhook:', error);
    return {
      success: false,
      message: 'Failed to call LinkedIn webhook: ' + error.toString(),
      error: error.toString()
    };
  }
}

/**
 * Test function for LinkedIn webhook
 */
function testLinkedInWebhook() {
  try {
    var testFormData = {
      jobTitle: 'Test Job Title',
      clientName: 'Test Client',
      location: 'Test Location',
      experienceLevel: '3-5 years',
      positions: '2',
      skills: 'JavaScript, React',
      jobDescription: 'Test job description',
      qualification: 'Bachelor Degree',
      onSiteOpportunity: 'Yes',
      salaryBracket: '$50,000 - $70,000',
      wantToPostOnLinkedIn: true
    };
    
    var result = callLinkedInWebhook(testFormData);
    console.log('Test webhook result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Test webhook error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Check if a requirement name already exists in bi_t14s table
 * @param {string} requirementName - The requirement name to check
 * @return {Object} Result object with exists flag
 */
function checkRequirementNameExists(requirementName) {
  try {
    console.log('=== CHECKING REQUIREMENT NAME EXISTS ===');
    console.log('Requirement name to check:', requirementName);
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userEmail = props.getProperty('email');
    
    if (!isLoggedIn) {
      return { success: false, exists: false, message: 'User not logged in' };
    }
    
    // Escape the requirement name for SQL
    var safeName = sqlSafe(requirementName);
    
    // Query to check if requirement name exists
    var checkQuery = `SELECT COUNT(*) as count FROM bi_t14s WHERE requirement_name = '${safeName}'`;
    
    console.log('Check query:', checkQuery);
    
    var result = fetchFromAPI(checkQuery);
    console.log('Check result:', JSON.stringify(result));
    
    // Parse the result
    if (result && result.length > 0) {
      var countData = result[0].bi_t14s || result[0]['0'] || result[0];
      var count = parseInt(countData.count || 0);
      
      console.log('Count of existing requirements:', count);
      
      if (count > 0) {
        return {
          success: true,
          exists: true,
          message: 'Job title already exists in database. Please use a unique job title.',
          count: count
        };
      } else {
        return {
          success: true,
          exists: false,
          message: 'Job title is unique'
        };
      }
    } else {
      return {
        success: true,
        exists: false,
        message: 'Job title is unique'
      };
    }
  } catch (error) {
    console.error('Error checking requirement name:', error);
    return {
      success: false,
      exists: false,
      message: 'Error checking requirement name: ' + error.toString()
    };
  }
}

/**
 * Post a new requirement to bi_t14s table
 * @param {Object} formData - Form data from the frontend
 * @return {Object} Result object with success status
 */
function postRequirement(formData) {
  try {
    console.log('=== POSTING NEW REQUIREMENT ===');
    console.log('Form data:', formData);
    
    // Check if user is logged in
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userEmail = props.getProperty('email');
    var userName = props.getProperty('userName');
    
    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }
    
    // Validate required fields
    if (!formData.jobTitle || !formData.clientName || !formData.requirementReceivedDate || 
        !formData.location || !formData.typeOfPosition || 
        !formData.experienceLevel || !formData.positions || !formData.requirementStatus || 
        !formData.skills || !formData.jobDescription || !formData.jdReceived || 
        !formData.onSiteOpportunity || !formData.involveTraveling || 
        !formData.newProject || !formData.markCompleteOnceAllFulfilled) {
      return { success: false, message: 'All required fields must be filled' };
    }
    
    // Check if requirement name (job title) already exists
    console.log('Checking if requirement name exists:', formData.jobTitle);
    var duplicateCheck = checkRequirementNameExists(formData.jobTitle);
    console.log('Duplicate check result:', duplicateCheck);
    
    if (duplicateCheck.exists) {
      console.log('Requirement name already exists, blocking submission');
      return {
        success: false,
        message: duplicateCheck.message || 'Job title already exists in database. Please use a unique job title.',
        isDuplicate: true
      };
    }
    
    console.log('Requirement name is unique, proceeding with insertion');
    
    // Get current date in proper format
    var currentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Create database connection
    var dbConnection = createDatabaseConnection();
    
    if (!dbConnection.success && dbConnection.error) {
      console.error('Failed to create database connection:', dbConnection.error);
      return {
        success: false,
        message: 'Database connection failed: ' + dbConnection.error
      };
    }
    
    try {
      // Look up client industry from bi_t8s based on selected client_name
      var industryName = '';
      try {
        var industryLookupQuery = 'SELECT client_industry1 FROM bi_t8s WHERE client_name = ? LIMIT 1';
        var industryLookupResult = dbConnection.execute(industryLookupQuery, [formData.clientName]);
        if (industryLookupResult && industryLookupResult.success && industryLookupResult.data && industryLookupResult.data.length > 0) {
          industryName = industryLookupResult.data[0].client_industry1 || '';
        }
        console.log('Resolved industry_name for client', formData.clientName, ':', industryName);
      } catch (industryErr) {
        console.error('Industry lookup failed:', industryErr);
      }

      // Build INSERT query with parameterized values for security
      var insertQuery = `INSERT INTO bi_t14s (
        requirement_received_date, 
        client_name, 
        date_of_allocation, 
        requirement_name, 
        open_no_of_position, 
        jd_received, 
        experince_range, 
        relevant_exp, 
        mandatory_skills, 
        any_qualification_criteria, 
        shift_details, 
        salary_bracket, 
        job_location, 
        onsite_opportunity, 
        does_the_profile_invovle_travelling, 
        specific_gender_requirement, 
        process_of_interview, 
        requirement_open_since, 
        type_of_position, 
        if_new_project, 
        requirement_status, 
        requirement_close_date, 
        team_leader, 
        due_date, 
        lead_ref_number, 
        note, 
        assign_to, 
        mark_complete_once_all_fulfilled, 
        Manager, 
        responsibilities, 
        past_company,
        industry_name,
        created_by, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      // Prepare parameters array
      var params = [
        formData.requirementReceivedDate,
        formData.clientName,
        formData.dateOfAllocation || '',
        formData.jobTitle,
        parseInt(formData.positions),
        formData.jdReceived || '',
        formData.experienceLevel,
        formData.relevantExp || '',
        formData.skills,
        formData.qualification || '',
        formData.shift || '',
        formData.salaryBracket || '',
        formData.location,
        formData.onSiteOpportunity || '',
        formData.involveTraveling || '',
        formData.specificGenderRequirement || '',
        formData.processOfInterview || '',
        formData.requirementOpenSince || '',
        formData.typeOfPosition,
        formData.newProject || '',
        formData.requirementStatus,
        formData.requirementCloseDate || '',
        formData.teamLeader || '',
        formData.dueDate || '',
        formData.leadRefNumber || '',
        (formData.additionalNotes || '') + (formData.wantToPostOnLinkedIn ? ' [LinkedIn Posting: Yes]' : ' [LinkedIn Posting: No]'),
        userName || userEmail,
        formData.markCompleteOnceAllFulfilled || '',
        formData.manager || '',
        formData.jobDescription,
        formData.pastCompany || '',
        industryName,
        parseInt(userId),
        currentDate
      ];
      
      console.log('Insert query:', insertQuery);
      console.log('Parameters:', params);
      
      // Execute the insert query
      var insertResult = dbConnection.execute(insertQuery, params);
      
      console.log('Insert result:', JSON.stringify(insertResult));
      
      if (insertResult.success) {
        console.log('Requirement inserted successfully. Affected rows:', insertResult.affectedRows);
        
        // Call LinkedIn webhook if checkbox was selected
        if (formData.wantToPostOnLinkedIn) {
          console.log('LinkedIn checkbox selected, calling webhook...');
          try {
            var webhookResult = callLinkedInWebhook(formData);
            console.log('Webhook result:', webhookResult);
          } catch (webhookError) {
            console.error('Webhook error:', webhookError);
            // Don't fail the form submission if webhook fails
          }
        } else {
          console.log('LinkedIn checkbox not selected, skipping webhook');
        }
        
        return {
          success: true,
          message: 'Requirement posted successfully',
          data: formData,
          affectedRows: insertResult.affectedRows
        };
      } else {
        console.error('Database insert failed:', insertResult.error);
        return {
          success: false,
          message: 'Database insert failed: ' + insertResult.error
        };
      }
      
    } catch (dbError) {
      console.error('Database operation error:', dbError);
      return {
        success: false,
        message: 'Database operation failed: ' + dbError.toString()
      };
    } finally {
      // Close database connection
      if (dbConnection && dbConnection.close) {
        dbConnection.close();
      }
    }
    
  } catch (error) {
    console.error('Error posting requirement:', error);
    return { 
      success: false, 
      message: 'Error posting requirement: ' + error.toString() 
    };
  }
}

/**
 * Reset search_executed flag for a job title (for testing)
 * @param {string} jobTitle - The job title to reset
 */
function resetSearchExecutedFlag(jobTitle) {
  try {
    console.log('=== RESETTING SEARCH_EXECUTED FLAG ===');
    console.log('Job title:', jobTitle);
    
    var resetQuery = `UPDATE bi_t14s SET search_executed = 0 WHERE requirement_name = '${sqlSafe(jobTitle)}'`;
    console.log('Reset query:', resetQuery);
    
    var result = fetchFromAPI(resetQuery);
    console.log('Reset result:', result);
    
    return {
      success: true,
      message: `Reset search_executed flag for "${jobTitle}"`
    };
    
  } catch (error) {
    console.error('Reset error:', error);
    return {
      success: false,
      message: 'Reset failed: ' + error.toString()
    };
  }
}

// Export candidates to Excel
function exportCandidatesToExcel(jobTitleFilter, statusFilter) {
  try {
    console.log('Export request - Job Title Filter:', jobTitleFilter, 'Status Filter:', statusFilter);
    
    // Get user data from script properties
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userEmail = props.getProperty('email');
    var userName = props.getProperty('userName');
    
    if (!isLoggedIn || !userId) {
      return {
        success: false,
        message: 'User not logged in'
      };
    }
    
    console.log('Export for user - ID:', userId, 'Name:', userName, 'Email:', userEmail);
    
    // Build WHERE clause for filtering
    var whereConditions = [];
    
    // Get user's assigned JDs first (same logic as other functions)
    var jobQuery = `SELECT DISTINCT bi_primary_id FROM bi_t14s 
                    WHERE assign_to LIKE '%${sqlSafe(userName || userEmail)}%' 
                    OR assign_to_others_1 LIKE '%${sqlSafe(userName || userEmail)}%' 
                    OR assign_to_others_2 LIKE '%${sqlSafe(userName || userEmail)}%'`;
    
    console.log('Getting assigned JDs with query:', jobQuery);
    var jobResult = fetchFromAPI(jobQuery);
    var jdIds = [];
    
    if (jobResult && Array.isArray(jobResult)) {
      jdIds = jobResult.map(function(jd) {
        return jd.bi_t14s ? jd.bi_t14s.bi_primary_id : jd.bi_primary_id;
      });
    }
    
    console.log('Found assigned JD IDs:', jdIds);
    
    if (jdIds.length === 0) {
      return {
        success: true,
        data: 'ID,Name,Requirement Name,Current Role,Current Company,Match %,Selection %,Reasoning,Email,Total Experience,Contact Number,Notice Period,Current Location,Preferred Location,Education,Current CTC,Source,Status,Resume URL\n',
        filename: 'candidates_export.csv',
        recordCount: 0,
        message: 'No candidates found - you are not assigned to any job descriptions'
      };
    }
    
    // Build WHERE conditions for bi_t31s table
    var whereConditions = [`job_id IN ('${jdIds.join("','")}')`];
    
    // Add job title filter if provided
    if (jobTitleFilter && jobTitleFilter.trim() !== '') {
      whereConditions.push(`requirement_name LIKE '%${sqlSafe(jobTitleFilter)}%'`);
    }
    
    // Add status filter if provided
    if (statusFilter && statusFilter.trim() !== '') {
      whereConditions.push(`status LIKE '%${sqlSafe(statusFilter)}%'`);
    }
    
    // Build the query
    var whereClause = 'WHERE ' + whereConditions.join(' AND ');
    
    var query = `
      SELECT 
        bi_primary_id,
        candidate_name,
        requirement_name,
        current_role,
        current_company,
        match_percentage,
        selection_percentage,
        reasoning,
        email,
        total_experience,
        contact_number,
        notice_period,
        current_location,
        preferred_locations,
        education,
        current_ctc,
        source,
        status,
        resume
      FROM bi_t31s 
      ${whereClause}
      ORDER BY bi_primary_id DESC
    `;
    
    
    // Execute query
    var result = fetchFromAPI(query);
    var candidates = [];
    
    if (result && result.status === 'success' && result.data) {
      candidates = result.data;
    } else if (Array.isArray(result)) {
      candidates = result;
    }
    
    // Process candidates data structure (same as other functions)
    if (candidates.length > 0) {
      var processedCandidates = [];
      
      candidates.forEach(function(candidate, index) {
        var candidateData = candidate.bi_t31s || candidate;
        var coalesceData = candidate['0'] || {};
        var mergedData = Object.assign({}, candidateData, coalesceData);
        
        // Only add if we have a valid candidate
        if (mergedData.bi_primary_id || mergedData.candidate_name) {
          processedCandidates.push(mergedData);
        }
      });
      
      candidates = processedCandidates;
    }
    
    // Create Excel data
    var excelData = createExcelData(candidates);
    
    // Generate filename
    var timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    var filename = `candidates_export_${timestamp}.csv`;
    
    return {
      success: true,
      data: excelData,
      filename: filename,
      recordCount: candidates.length,
      message: `Successfully exported ${candidates.length} candidates`
    };
    
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      message: 'Export failed: ' + error.toString()
    };
  }
}


// Create Excel data from candidates
function createExcelData(candidates) {
  try {
    // Headers
    var headers = [
      'ID', 'Name', 'Requirement Name', 'Current Role', 'Current Company',
      'Match %', 'Selection %', 'Reasoning', 'Email', 'Total Experience',
      'Contact Number', 'Notice Period', 'Current Location', 'Preferred Location',
      'Education', 'Current CTC', 'Source', 'Status', 'Resume URL'
    ];
    
    // Create CSV content (Excel can open CSV files)
    var csvContent = headers.join(',') + '\n';
    
    candidates.forEach(function(candidate, index) {
      var row = [
        candidate.bi_primary_id || '',
        `"${(candidate.candidate_name || '').replace(/"/g, '""')}"`, // Escape quotes
        `"${(candidate.requirement_name || '').replace(/"/g, '""')}"`,
        `"${(candidate.current_role || '').replace(/"/g, '""')}"`,
        `"${(candidate.current_company || '').replace(/"/g, '""')}"`,
        candidate.match_percentage || '',
        candidate.selection_percentage || '',
        `"${(candidate.reasoning || '').replace(/"/g, '""')}"`,
        candidate.email || '',
        candidate.total_experience || '',
        candidate.contact_number || '',
        candidate.notice_period || '',
        `"${(candidate.current_location || '').replace(/"/g, '""')}"`,
        `"${(candidate.preferred_locations || '').replace(/"/g, '""')}"`,
        `"${(candidate.education || '').replace(/"/g, '""')}"`,
        candidate.current_ctc || '',
        candidate.source || '',
        candidate.status || '',
        candidate.resume || ''
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Convert to base64 for transfer
    var base64Data = Utilities.base64Encode(csvContent);
    
    return base64Data;
    
  } catch (error) {
    console.error('Error creating Excel data:', error);
    throw error;
  }
}


function testrequiremet_post() {
  try {
    var props = PropertiesService.getScriptProperties();
    var isLoggedIn = props.getProperty('isLoggedIn');
    var userId = props.getProperty('user_id');
    var userEmail = props.getProperty('email');

    if (!isLoggedIn || !userId) {
      console.log('User not logged in');
      return { success: false, message: 'User not logged in' };
    }

    var requestTime = getCurrentRequestTime();
    var endpoint = "apis/getQueryData/?request_time=" + requestTime;
    var url = buildApiUrl(endpoint);
    var xcode = generateXCode(endpoint);

    // --- Hardcoded SQL Query ---
    var insertQuery = ` 
      INSERT INTO bi_t14s (requirement_received_date, client_name, date_of_allocation, requirement_name, open_no_of_position, jd_received, experince_range, relevant_exp, mandatory_skills,any_qualification_criteria, shift_details, salary_bracket, job_location, onsite_opportunity, does_the_profile_invovle_travelling, specific_gender_requirement, process_of_interview, requirement_open_since, type_of_position, if_new_project, requirement_status, requirement_close_date, team_leader, due_date, lead_ref_number, note, assign_to, 
      mark_complete_once_all_fulfilled, Manager, responsibilities, past_company, created_by, created_at) VALUES ('2025-10-15','INRHYTHM SOLUTIONS','','Software Engineer 3',1,'','3-5 year','','','', '','Pune','', '', 'No Preference','','','Replacement','','Open','','','','', '[LinkedIn Posting: Yes]','Gayatri Gade','','Shavita K','Design, Develop, and Maintain Software  Write clean, efficient, and maintainable code using best practices.  Participate in the design and architecture of new software modules or features.  Debug and resolve software defects and performance issues.  Code Review & Quality Assurance  Conduct peer code reviews to ensure code quality, readability, and adherence to standards.  Write and maintain unit tests, integration tests, and automated test scripts.  Contribute to continuous integration and deployment (CI/CD) pipelines.  Collaboration & Communication  Collaborate closely with cross-functional teams (QA, DevOps, UI/UX, Product Managers).  Participate in agile ceremonies such as sprint planning, stand-ups, and retrospectives.  Provide accurate time estimates and progress updates to stakeholders.  System Optimization & Maintenance  Optimize application performance, scalability, and reliability.  Monitor production systems and assist in troubleshooting incidents.  Refactor legacy code to improve maintainability and performance.  Documentation  Document software designs, APIs, and technical specifications.  Maintain project documentation for internal and external use.','',1066,'2025-10-17')`;

    // --- POST request options ---
     


    var options = {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
       payload : {
        query: insertQuery,
        email: userEmail
      },
      headers: {
        "X-Api-Key": "629db3-767b90-a0aa14-aceccd-42ebbe",
        "X-Code": xcode,
        "X-Request-Time": requestTime
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    console.log("Request URL: " + url);
    console.log("Insert Query: " + insertQuery);
    console.log("Response Code: " + responseCode);
    console.log("Response Body: " + responseBody);

    return { success: true, code: responseCode, response: responseBody };

  } catch (error) {
    console.log("Error occurred: " + error);
    return { success: false, message: error.toString() };
  }
}



