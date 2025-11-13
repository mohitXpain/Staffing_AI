<?php
// include teamob api
require_once __DIR__ . "/_private/teamob-api.php";
// include storage engine
require_once __DIR__ . "/_private/storage.php";
// include api definitions
require_once __DIR__ . "/_private/api.php";

// Global error and exception handlers to prevent 500 errors
// Only catch fatal errors (E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR)
set_error_handler(function($errno, $errstr, $errfile, $errline) {
	// Only handle fatal errors, ignore warnings and notices
	if ($errno === E_ERROR || $errno === E_PARSE || $errno === E_CORE_ERROR || 
	    $errno === E_COMPILE_ERROR || $errno === E_USER_ERROR) {
		header('Content-Type: application/json');
		http_response_code(200);
		echo json_encode([
			"success" => false,
			"error" => "php_error",
			"message" => $errstr,
			"file" => $errfile,
			"line" => $errline
		]);
		exit;
	}
	// Return false to let PHP handle non-fatal errors normally
	return false;
});

set_exception_handler(function($exception) {
	header('Content-Type: application/json');
	http_response_code(200);
	echo json_encode([
		"success" => false,
		"error" => "exception",
		"message" => $exception->getMessage(),
		"file" => $exception->getFile(),
		"line" => $exception->getLine(),
		"trace" => $exception->getTraceAsString()
	]);
	exit;
});

// Get table name from module_files for client-related queries
function get_client_table_name() {
	// Static variable to cache in memory (works even if storage is not available)
	static $cachedTableName = null;
	
	// Check in-memory cache first
	if ($cachedTableName !== null) {
		return $cachedTableName;
	}
	
	// Try to get from storage cache (if available)
	try {
		$cachedTable = storage_get("client_table_name", null);
		if ($cachedTable !== null) {
			$cachedTableName = $cachedTable; // Cache in memory too
			return $cachedTable;
		}
	} catch (Exception $e) {
		// Storage not available, continue
	}
	
	// Try to get from cached module_files data (if available)
	try {
		$moduleFiles = storage_get("module_files_staffing", null);
		if ($moduleFiles !== null && is_array($moduleFiles)) {
			foreach ($moduleFiles as $file) {
				if (isset($file['pagename']) && stripos($file['pagename'], 'client') !== false) {
					$filename = $file['filename'];
					$cachedTableName = $filename; // Cache in memory
					try {
						storage_set("client_table_name", $filename); // Try to cache in storage
					} catch (Exception $e) {
						// Storage not available, continue
					}
					return $filename;
				}
			}
		}
	} catch (Exception $e) {
		// Storage not available, continue
	}
	
	// If not in cache, fetch from module_files table directly
	try {
		$sql = "SELECT filename, pagename FROM module_files WHERE module_name = 'staffing' AND (pagename LIKE '%client%') LIMIT 1";
		$result = teamob_query($sql);
		
		// Handle different response formats
		$filename = null;
		
		if ($result && isset($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
			$data = $result['data'][0];
			$filename = isset($data['module_files']['filename']) ? $data['module_files']['filename'] : $data['filename'];
		} elseif (is_array($result) && count($result) > 0) {
			$data = $result[0];
			$filename = isset($data['filename']) ? $data['filename'] : null;
		}
		
		// If filename found, cache it and return
		if ($filename) {
			$cachedTableName = $filename; // Cache in memory
			try {
				storage_set("client_table_name", $filename); // Try to cache in storage
			} catch (Exception $e) {
				// Storage not available, continue
			}
			return $filename;
		}
	} catch (Exception $e) {
		// On error, fallback to default table name
		error_log("Error fetching client table name: " . $e->getMessage());
	}
	
	// Fallback to default table name if not found
	$defaultTable = "bi_t8s";
	$cachedTableName = $defaultTable; // Cache in memory
	try {
		storage_set("client_table_name", $defaultTable); // Try to cache in storage
	} catch (Exception $e) {
		// Storage not available, continue
	}
	return $defaultTable;
}

function get_clients($params) {
	// Get dynamic table name
	$tableName = get_client_table_name();
	
	$sql = "SELECT DISTINCT client_name 
			FROM $tableName 
			WHERE client_name IS NOT NULL AND client_name != '' 
			ORDER BY client_name ASC";
	
	return teamob_query($sql);
}

function add_client($params) {
    if (empty($params['name'])) {
        return ["error" => "Client name required"];
    }
    return ["success" => true, "name" => $params['name']];
}

// Get table name from module_files for requirement-related queries
function get_requirement_table_name() {
	// Static variable to cache in memory (works even if storage is not available)
	static $cachedTableName = null;
	
	// Check in-memory cache first
	if ($cachedTableName !== null) {
		return $cachedTableName;
	}
	
	// Try to get from storage cache (if available)
	try {
		$cachedTable = storage_get("requirement_table_name", null);
		if ($cachedTable !== null) {
			$cachedTableName = $cachedTable; // Cache in memory too
			return $cachedTable;
		}
	} catch (Exception $e) {
		// Storage not available, continue
	}
	
	// Try to get from cached module_files data (if available)
	try {
		$moduleFiles = storage_get("module_files_staffing", null);
		if ($moduleFiles !== null && is_array($moduleFiles)) {
			foreach ($moduleFiles as $file) {
				if (isset($file['pagename']) && stripos($file['pagename'], 'requirement') !== false) {
					$filename = $file['filename'];
					$cachedTableName = $filename; // Cache in memory
					try {
						storage_set("requirement_table_name", $filename); // Try to cache in storage
					} catch (Exception $e) {
						// Storage not available, continue
					}
					return $filename;
				}
			}
		}
	} catch (Exception $e) {
		// Storage not available, continue
	}
	
	// If not in cache, fetch from module_files table directly
	try {
		$sql = "SELECT filename, pagename FROM module_files WHERE module_name = 'staffing' AND (pagename LIKE '%requirement%' OR pagename LIKE '%post requirement%') LIMIT 1";
		$result = teamob_query($sql);
		
		// Handle different response formats
		$filename = null;
		
		if ($result && isset($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
			$data = $result['data'][0];
			$filename = isset($data['module_files']['filename']) ? $data['module_files']['filename'] : $data['filename'];
		} elseif (is_array($result) && count($result) > 0) {
			$data = $result[0];
			$filename = isset($data['filename']) ? $data['filename'] : null;
		}
		
		// If filename found, cache it and return
		if ($filename) {
			$cachedTableName = $filename; // Cache in memory
			try {
				storage_set("requirement_table_name", $filename); // Try to cache in storage
			} catch (Exception $e) {
				// Storage not available, continue
			}
			return $filename;
		}
	} catch (Exception $e) {
		// On error, fallback to default table name
		error_log("Error fetching requirement table name: " . $e->getMessage());
	}
	
	// Fallback to default table name if not found
	$defaultTable = "bi_t14s";
	$cachedTableName = $defaultTable; // Cache in memory
	try {
		storage_set("requirement_table_name", $defaultTable); // Try to cache in storage
	} catch (Exception $e) {
		// Storage not available, continue
	}
	return $defaultTable;
}

// Initialize and cache module_files data (lazy loading - only when needed)
function init_module_files_cache() {
	// Static variable to cache in memory (works even if storage is not available)
	static $cachedModuleFiles = null;
	
	// Check in-memory cache first
	if ($cachedModuleFiles !== null) {
		return $cachedModuleFiles;
	}
	
	// Check if already cached in storage
	try {
		$cached = storage_get("module_files_staffing", null);
		if ($cached !== null && is_array($cached)) {
			$cachedModuleFiles = $cached; // Cache in memory too
			return $cached;
		}
	} catch (Exception $e) {
		// Storage not available, continue
	}
	
	// Fetch all module_files for staffing module
	try {
		$sql = "SELECT filename, pagename, module_name FROM module_files WHERE module_name = 'staffing'";
		$result = teamob_query($sql);
		
		// Handle different response formats
		$moduleFiles = [];
		
		if ($result && isset($result['data']) && is_array($result['data'])) {
			foreach ($result['data'] as $item) {
				$filename = isset($item['module_files']['filename']) ? $item['module_files']['filename'] : $item['filename'];
				$pagename = isset($item['module_files']['pagename']) ? $item['module_files']['pagename'] : $item['pagename'];
				$moduleFiles[] = [
					'filename' => $filename,
					'pagename' => $pagename
				];
			}
		} elseif (is_array($result)) {
			foreach ($result as $item) {
				if (isset($item['filename'])) {
					$moduleFiles[] = [
						'filename' => $item['filename'],
						'pagename' => isset($item['pagename']) ? $item['pagename'] : ''
					];
				}
			}
		}
		
		// Cache in memory (always works)
		$cachedModuleFiles = $moduleFiles;
		
		// Try to cache in storage (optional - may fail silently)
		try {
			storage_set("module_files_staffing", $moduleFiles);
		} catch (Exception $e) {
			// Storage not available, continue
		}
		
		// Also cache the requirement table name specifically
		foreach ($moduleFiles as $file) {
			if (stripos($file['pagename'], 'requirement') !== false) {
				try {
					storage_set("requirement_table_name", $file['filename']);
				} catch (Exception $e) {
					// Storage not available, continue
				}
				break;
			}
		}
		
		// Also cache the client table name specifically
		foreach ($moduleFiles as $file) {
			if (stripos($file['pagename'], 'client') !== false) {
				try {
					storage_set("client_table_name", $file['filename']);
				} catch (Exception $e) {
					// Storage not available, continue
				}
				break;
			}
		}
		
		// Also cache the profile table name specifically
		foreach ($moduleFiles as $file) {
			if (stripos($file['pagename'], 'profile') !== false || 
			    stripos($file['pagename'], 'candidate') !== false || 
			    stripos($file['pagename'], 'scrape') !== false || 
			    stripos($file['pagename'], 'lead') !== false) {
				try {
					storage_set("profile_table_name", $file['filename']);
				} catch (Exception $e) {
					// Storage not available, continue
				}
				break;
			}
		}
		
		return $moduleFiles;
	} catch (Exception $e) {
		error_log("Error fetching module_files: " . $e->getMessage());
		return [];
	}
}

// Don't initialize cache on script load - make it lazy (only when needed)
// This prevents errors if storage directory is not writable

// TeamOB API call example
function get_users($params) {
	$sql = "SELECT * FROM users limit 1";
    return teamob_query($sql);
}

// database call example
function db_operations($params) {
	// Store
	storage_set("last_sync_time", date("c"));

	// Retrieve
	$lastSync = storage_get("last_sync_time", "not set");

	// Custom SQL (adds a tasks table if not exists)
	storage_query("CREATE TABLE IF NOT EXISTS tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT
	)");

	storage_query("INSERT INTO tasks (name) VALUES ('Demo Task')");
	$tasks = storage_query("SELECT * FROM tasks");
	
	return [
		"last_sync_time" => $lastSync,
		"tasks" => $tasks
	];
}

// Check if job title already exists in database
function check_job_title_exists($jobTitle) {
	if (empty($jobTitle)) {
		return false;
	}
	
	// Get dynamic table name
	$tableName = get_requirement_table_name();
	
	$escapedJobTitle = addslashes($jobTitle);
	// Use SELECT to get actual records instead of COUNT
	$sql = "SELECT bi_primary_id, requirement_name FROM $tableName WHERE requirement_name = '$escapedJobTitle' LIMIT 1";
	
	try {
		$result = teamob_query($sql);
	} catch (Exception $e) {
		// On any error, be conservative and allow insertion (treat as not existing)
		return false;
	}
	
	// Check if we got any results back
	// Handle different response formats from teamob_query
	if ($result && isset($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
		return true; // Record exists
	} elseif (is_array($result) && count($result) > 0) {
		// Check if it's not just an empty array or error response
		$firstItem = $result[0];
		if (is_array($firstItem) && (isset($firstItem['bi_primary_id']) || isset($firstItem['requirement_name']))) {
			return true; // Record exists
		}
	}
	
	return false;
}

// Add requirement function - stores data in bi_t14s table
function add_requirement($params) {
	// Map form fields to database columns
	$requirementName = isset($params['jobTitle']) ? addslashes($params['jobTitle']) : '';
	
	// Log 1: Check if job title already exists
	if (!empty($requirementName) && check_job_title_exists($requirementName)) {
		return [
			"success" => false,
			"error" => "Job title already exists in the database. Please provide a unique job title.",
			"field" => "jobTitle"
		];
	}
	
	$clientName = isset($params['clientName']) ? addslashes($params['clientName']) : '';
	$requirementReceivedDate = isset($params['requirementReceivedDate']) ? addslashes($params['requirementReceivedDate']) : NULL;
	$dueDate = isset($params['dueDate']) && !empty($params['dueDate']) ? addslashes($params['dueDate']) : NULL;
	$leadRefNumber = isset($params['leadRefNumber']) && !empty($params['leadRefNumber']) ? addslashes($params['leadRefNumber']) : NULL;
	$dateOfAllocation = isset($params['dateOfAllocation']) && !empty($params['dateOfAllocation']) ? addslashes($params['dateOfAllocation']) : NULL;
	$teamLeader = isset($params['teamLeader']) && !empty($params['teamLeader']) ? addslashes($params['teamLeader']) : NULL;
	$jobLocation = isset($params['location']) ? addslashes($params['location']) : NULL;
	$pastCompany = isset($params['pastCompany']) && !empty($params['pastCompany']) ? addslashes($params['pastCompany']) : NULL;
	$typeOfPosition = isset($params['typeOfPosition']) ? addslashes($params['typeOfPosition']) : NULL;
	$experinceRange = isset($params['experienceLevel']) ? addslashes($params['experienceLevel']) : NULL;
	$relevantExp = isset($params['relevantExp']) && !empty($params['relevantExp']) ? addslashes($params['relevantExp']) : NULL;
	$openNoOfPosition = isset($params['positions']) ? intval($params['positions']) : NULL;
	$anyQualificationCriteria = isset($params['qualification']) && !empty($params['qualification']) ? addslashes($params['qualification']) : NULL;
	$salaryBracket = isset($params['salaryBracket']) && !empty($params['salaryBracket']) ? addslashes($params['salaryBracket']) : NULL;
	$shiftDetails = isset($params['shift']) && !empty($params['shift']) ? addslashes($params['shift']) : NULL;
	$onsiteOpportunity = isset($params['onSiteOpportunity']) ? addslashes($params['onSiteOpportunity']) : NULL;
	$doesTheProfileInvovleTravelling = isset($params['involveTraveling']) ? addslashes($params['involveTraveling']) : NULL;
	$specificGenderRequirement = isset($params['specificGenderRequirement']) && !empty($params['specificGenderRequirement']) ? addslashes($params['specificGenderRequirement']) : NULL;
	$processOfInterview = isset($params['processOfInterview']) && !empty($params['processOfInterview']) ? addslashes($params['processOfInterview']) : NULL;
	$requirementOpenSince = isset($params['requirementOpenSince']) && !empty($params['requirementOpenSince']) ? addslashes($params['requirementOpenSince']) : NULL;
	$requirementCloseDate = isset($params['requirementCloseDate']) && !empty($params['requirementCloseDate']) ? addslashes($params['requirementCloseDate']) : NULL;
	$ifNewProject = isset($params['newProject']) ? addslashes($params['newProject']) : NULL;
	$requirementStatus = isset($params['requirementStatus']) ? addslashes($params['requirementStatus']) : NULL;
	$jdReceived = isset($params['jdReceived']) ? addslashes($params['jdReceived']) : NULL;
	$manager = isset($params['manager']) && !empty($params['manager']) ? addslashes($params['manager']) : NULL;
	$markCompleteOnceAllFulfilled = isset($params['markCompleteOnceAllFulfilled']) ? addslashes($params['markCompleteOnceAllFulfilled']) : NULL;
	$mandatorySkills = isset($params['skills']) ? addslashes($params['skills']) : NULL;
	$responsibilities = isset($params['jobDescription']) ? addslashes($params['jobDescription']) : NULL;
	$note = isset($params['additionalNotes']) && !empty($params['additionalNotes']) ? addslashes($params['additionalNotes']) : NULL;
	
	// Get client_industry1 from client table using dynamic table name
	$industryName = NULL;
	if (!empty($clientName)) {
		try {
			$clientTableName = get_client_table_name();
			$industrySql = "SELECT client_industry1 FROM $clientTableName WHERE client_name = '$clientName' LIMIT 1";
			$industryResult = teamob_query($industrySql);
			
			// Handle different response formats from teamob_query
			if ($industryResult && isset($industryResult['data']) && is_array($industryResult['data']) && count($industryResult['data']) > 0) {
				$industryData = $industryResult['data'][0];
				// Check for nested table name structure
				$keys = array_keys($industryData);
				if (count($keys) > 0 && isset($industryData[$keys[0]]['client_industry1'])) {
					$industryName = $industryData[$keys[0]]['client_industry1'];
				} elseif (isset($industryData['client_industry1'])) {
					$industryName = $industryData['client_industry1'];
				}
			} elseif (is_array($industryResult) && count($industryResult) > 0) {
				$industryData = $industryResult[0];
				// Check for nested table name structure
				$keys = array_keys($industryData);
				if (count($keys) > 0 && isset($industryData[$keys[0]]['client_industry1'])) {
					$industryName = $industryData[$keys[0]]['client_industry1'];
				} elseif (isset($industryData['client_industry1'])) {
					$industryName = $industryData['client_industry1'];
				}
			}
			
			// Clean up the industry name
			if ($industryName !== NULL) {
				$industryName = addslashes(trim($industryName));
				if (empty($industryName)) {
					$industryName = NULL;
				}
			}
		} catch (Exception $e) {
			// If we can't get industry, continue without it (don't fail the insert)
			error_log("Error fetching client industry: " . $e->getMessage());
			$industryName = NULL;
		}
	}
	
	// Get user_id and fetch user details for created_by and assign_to
	$userId = isset($params['user_id']) ? intval($params['user_id']) : 0;
	$assignTo = NULL;
	
	if ($userId > 0) {
		try {
			$userSql = "SELECT first_name, last_name FROM users WHERE user_id = $userId LIMIT 1";
			$userResult = teamob_query($userSql);
			
			// Parse user data
			if ($userResult && isset($userResult['data']) && is_array($userResult['data']) && count($userResult['data']) > 0) {
				$userData = $userResult['data'][0];
				$firstName = null;
				$lastName = null;
				
				if (isset($userData['users'])) {
					$firstName = isset($userData['users']['first_name']) ? $userData['users']['first_name'] : null;
					$lastName = isset($userData['users']['last_name']) ? $userData['users']['last_name'] : null;
				} elseif (isset($userData['first_name'])) {
					$firstName = $userData['first_name'];
					$lastName = isset($userData['last_name']) ? $userData['last_name'] : null;
				}
				
				if ($firstName || $lastName) {
					$assignTo = trim(($firstName ? $firstName : '') . ' ' . ($lastName ? $lastName : ''));
					$assignTo = !empty($assignTo) ? addslashes($assignTo) : NULL;
				}
			} elseif (is_array($userResult) && count($userResult) > 0) {
				$userData = $userResult[0];
				$firstName = isset($userData['first_name']) ? $userData['first_name'] : null;
				$lastName = isset($userData['last_name']) ? $userData['last_name'] : null;
				
				if ($firstName || $lastName) {
					$assignTo = trim(($firstName ? $firstName : '') . ' ' . ($lastName ? $lastName : ''));
					$assignTo = !empty($assignTo) ? addslashes($assignTo) : NULL;
				}
			}
		} catch (Exception $e) {
			error_log("Error fetching user details: " . $e->getMessage());
			$assignTo = NULL;
		}
	}
	
	// Use user_id for created_by, default to 0 if not provided
	$createdBy = $userId > 0 ? $userId : 0;
	
	// Get dynamic table name
	$tableName = get_requirement_table_name();
	
	// Build SQL INSERT statement
	$sql = "INSERT INTO $tableName (
		created_by, created_at, requirement_received_date, client_name, date_of_allocation,
		requirement_name, open_no_of_position, jd_received, experince_range, relevant_exp,
		mandatory_skills, any_qualification_criteria, shift_details, salary_bracket,
		job_location, onsite_opportunity, does_the_profile_invovle_travelling,
		specific_gender_requirement, process_of_interview, requirement_open_since,
		type_of_position, if_new_project, requirement_status, requirement_close_date,
		team_leader, due_date, lead_ref_number, note, mark_complete_once_all_fulfilled,
		Manager, responsibilities, past_company, industry_name, assign_to
	) VALUES (
		$createdBy, CURDATE(), " . ($requirementReceivedDate ? "'$requirementReceivedDate'" : "NULL") . ",
		" . ($clientName ? "'$clientName'" : "NULL") . ",
		" . ($dateOfAllocation ? "'$dateOfAllocation'" : "NULL") . ",
		" . ($requirementName ? "'$requirementName'" : "NULL") . ",
		" . ($openNoOfPosition !== NULL ? $openNoOfPosition : "NULL") . ",
		" . ($jdReceived ? "'$jdReceived'" : "NULL") . ",
		" . ($experinceRange ? "'$experinceRange'" : "NULL") . ",
		" . ($relevantExp ? "'$relevantExp'" : "NULL") . ",
		" . ($mandatorySkills ? "'$mandatorySkills'" : "NULL") . ",
		" . ($anyQualificationCriteria ? "'$anyQualificationCriteria'" : "NULL") . ",
		" . ($shiftDetails ? "'$shiftDetails'" : "NULL") . ",
		" . ($salaryBracket ? "'$salaryBracket'" : "NULL") . ",
		" . ($jobLocation ? "'$jobLocation'" : "NULL") . ",
		" . ($onsiteOpportunity ? "'$onsiteOpportunity'" : "NULL") . ",
		" . ($doesTheProfileInvovleTravelling ? "'$doesTheProfileInvovleTravelling'" : "NULL") . ",
		" . ($specificGenderRequirement ? "'$specificGenderRequirement'" : "NULL") . ",
		" . ($processOfInterview ? "'$processOfInterview'" : "NULL") . ",
		" . ($requirementOpenSince ? "'$requirementOpenSince'" : "NULL") . ",
		" . ($typeOfPosition ? "'$typeOfPosition'" : "NULL") . ",
		" . ($ifNewProject ? "'$ifNewProject'" : "NULL") . ",
		" . ($requirementStatus ? "'$requirementStatus'" : "NULL") . ",
		" . ($requirementCloseDate ? "'$requirementCloseDate'" : "NULL") . ",
		" . ($teamLeader ? "'$teamLeader'" : "NULL") . ",
		" . ($dueDate ? "'$dueDate'" : "NULL") . ",
		" . ($leadRefNumber ? "'$leadRefNumber'" : "NULL") . ",
		" . ($note ? "'$note'" : "NULL") . ",
		" . ($markCompleteOnceAllFulfilled ? "'$markCompleteOnceAllFulfilled'" : "NULL") . ",
		" . ($manager ? "'$manager'" : "NULL") . ",
		" . ($responsibilities ? "'$responsibilities'" : "NULL") . ",
		" . ($pastCompany ? "'$pastCompany'" : "NULL") . ",
		" . ($industryName ? "'$industryName'" : "NULL") . ",
		" . ($assignTo ? "'$assignTo'" : "NULL") . "
	)";
	
	// Execute the SQL INSERT statement
	try {
		$insertResult = teamob_query($sql);
	} catch (Exception $e) {
		return [
			"success" => false,
			"error" => "db_insert_failed",
			"message" => $e->getMessage()
		];
	}
	
	// Get the last inserted ID by querying the database
	try {
		$getIdSql = "SELECT bi_primary_id, requirement_name FROM $tableName WHERE requirement_name = '$requirementName' AND client_name = '$clientName' ORDER BY bi_primary_id DESC LIMIT 1";
		$idResult = teamob_query($getIdSql);
		
		// Handle different response formats from teamob_query
		$biPrimaryId = null;
		
		if ($idResult && isset($idResult['data']) && is_array($idResult['data']) && count($idResult['data']) > 0) {
			$insertedData = $idResult['data'][0];
			$biPrimaryId = isset($insertedData['bi_t14s']['bi_primary_id']) ? $insertedData['bi_t14s']['bi_primary_id'] : $insertedData['bi_primary_id'];
		} elseif (is_array($idResult) && count($idResult) > 0) {
			$insertedData = $idResult[0];
			$biPrimaryId = isset($insertedData['bi_primary_id']) ? $insertedData['bi_primary_id'] : (isset($insertedData['bi_t14s']['bi_primary_id']) ? $insertedData['bi_t14s']['bi_primary_id'] : null);
		}
		
		if ($biPrimaryId) {
			return [
				"success" => true,
				"message" => "Your requirement is stored in CRM successfully. Please click on OK to create the campaign.",
				"bi_primary_id" => $biPrimaryId
			];
		} else {
			// Insert might have succeeded but we couldn't get the ID
			return [
				"success" => true,
				"message" => "Your requirement is stored in CRM successfully. Please click on OK to create the campaign.",
				"bi_primary_id" => null
			];
		}
	} catch (Exception $e) {
		return [
			"success" => false,
			"error" => "db_fetch_id_failed",
			"message" => $e->getMessage()
		];
	}
}

// Get requirements function - fetches data from dynamic table
function get_requirements($params) {
	// Get dynamic table name
	$tableName = get_requirement_table_name();
	
	// Get user_id and fetch user's name for filtering
	$userId = isset($params['user_id']) ? intval($params['user_id']) : 0;
	$userName = null;
	
	if ($userId > 0) {
		try {
			$userSql = "SELECT first_name, last_name FROM users WHERE user_id = $userId LIMIT 1";
			$userResult = teamob_query($userSql);
			
			// Parse user data
			if ($userResult && isset($userResult['data']) && is_array($userResult['data']) && count($userResult['data']) > 0) {
				$userData = $userResult['data'][0];
				$firstName = null;
				$lastName = null;
				
				if (isset($userData['users'])) {
					$firstName = isset($userData['users']['first_name']) ? $userData['users']['first_name'] : null;
					$lastName = isset($userData['users']['last_name']) ? $userData['users']['last_name'] : null;
				} elseif (isset($userData['first_name'])) {
					$firstName = $userData['first_name'];
					$lastName = isset($userData['last_name']) ? $userData['last_name'] : null;
				}
				
				if ($firstName || $lastName) {
					$userName = trim(($firstName ? $firstName : '') . ' ' . ($lastName ? $lastName : ''));
				}
			} elseif (is_array($userResult) && count($userResult) > 0) {
				$userData = $userResult[0];
				$firstName = isset($userData['first_name']) ? $userData['first_name'] : null;
				$lastName = isset($userData['last_name']) ? $userData['last_name'] : null;
				
				if ($firstName || $lastName) {
					$userName = trim(($firstName ? $firstName : '') . ' ' . ($lastName ? $lastName : ''));
				}
			}
		} catch (Exception $e) {
			error_log("Error fetching user details for requirements: " . $e->getMessage());
		}
	}
	
	// Build SQL query
	if ($userName && !empty($userName)) {
		// Filter by user's name in assign_to, assign_to_others_1, or assign_to_others_2
		$escapedUserName = addslashes($userName);
		$sql = "SELECT bi_primary_id, requirement_name, client_name, requirement_received_date, job_location, requirement_status 
				FROM $tableName 
				WHERE (assign_to LIKE '%$escapedUserName%' OR assign_to_others_1 LIKE '%$escapedUserName%' OR assign_to_others_2 LIKE '%$escapedUserName%')
				AND requirement_status = 'Open'
				AND requirement_name IS NOT NULL
				AND requirement_name != ''
				ORDER BY requirement_name ASC";
	} else {
		// If no user_id or user not found, return empty or all open requirements (fallback)
		$sql = "SELECT bi_primary_id, requirement_name, client_name, requirement_received_date, job_location, requirement_status 
				FROM $tableName 
				WHERE requirement_status = 'Open'
				AND requirement_name IS NOT NULL
				AND requirement_name != ''
				ORDER BY requirement_name ASC";
	}
	
	return teamob_query($sql);
}

// Get managers function - fetches managers from users table
function get_managers($params) {
	$sql = "SELECT user_id, CONCAT_WS(' ', first_name, last_name) as fullname 
			FROM users 
			WHERE role = 5 AND status = '1' 
			ORDER BY fullname ASC";
	
	return teamob_query($sql);
}

// Get team leaders function - fetches team leaders from users table
function get_team_leaders($params) {
	$sql = "SELECT user_id, CONCAT_WS(' ', first_name, last_name) as fullname 
			FROM users 
			WHERE role = 5 AND status = '1' 
			ORDER BY fullname ASC";
	
	return teamob_query($sql);
}

// Get campaign status function - checks if a campaign exists for a given requirement
function get_campaign_status($params) {
	$requirementId = isset($params['requirement_id']) ? intval($params['requirement_id']) : 0;
	
	if ($requirementId === 0) {
		return [
			"success" => false,
			"error" => "Invalid requirement ID"
		];
	}
	
	// Use static table name as requested
	$tableName = "workflow_campaigns";
	
	$sql = "SELECT id FROM $tableName WHERE ref_table_id = $requirementId LIMIT 1";
	
	try {
		$result = teamob_query($sql);
		
		// Handle different response formats from teamob_query
		$campaignExists = false;
		$campaignId = null;
		
		if ($result && isset($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
			$campaignExists = true;
			$data = $result['data'][0];
			// Extract campaign ID
			$keys = array_keys($data);
			if (count($keys) > 0 && isset($data[$keys[0]]['id'])) {
				$campaignId = $data[$keys[0]]['id'];
			} elseif (isset($data['id'])) {
				$campaignId = $data['id'];
			}
		} elseif (is_array($result) && count($result) > 0) {
			// Check if it's a valid result (not just an empty array)
			$firstItem = $result[0];
			if (is_array($firstItem) && (isset($firstItem['id']) || isset($firstItem['workflow_campaigns']))) {
				$campaignExists = true;
				$campaignId = isset($firstItem['id']) ? $firstItem['id'] : (isset($firstItem['workflow_campaigns']['id']) ? $firstItem['workflow_campaigns']['id'] : null);
			}
		}
		
		// If campaign exists, get selected posting options from workflow_registry
		$selectedOptions = [
			"linkedinPosting" => false,
			"facebookPosting" => false,
			"twitterPosting" => false,
			"linkedinScraper" => false,
			"githubScraper" => false,
			"linkedinMessaging" => false
		];
		
		if ($campaignExists && $campaignId) {
			$workflowSql = "SELECT workflow_name, params FROM workflow_registry WHERE campaign_id = $campaignId";
			$workflowResult = teamob_query($workflowSql);
			
			if ($workflowResult && isset($workflowResult['data']) && is_array($workflowResult['data']) && count($workflowResult['data']) > 0) {
				foreach ($workflowResult['data'] as $item) {
					$workflowName = null;
					$params = null;
					
					// Parse workflow_name
					if (isset($item['workflow_registry'])) {
						$workflowName = isset($item['workflow_registry']['workflow_name']) ? $item['workflow_registry']['workflow_name'] : null;
						$params = isset($item['workflow_registry']['params']) ? $item['workflow_registry']['params'] : null;
					} elseif (isset($item['workflow_name'])) {
						$workflowName = $item['workflow_name'];
						$params = isset($item['params']) ? $item['params'] : null;
					}
					
					if ($workflowName) {
						// Check for LinkedIn Scraper
						if (stripos($workflowName, 'Linkedin Scraper') !== false) {
							$selectedOptions['linkedinScraper'] = true;
						}
						
						// Check for Github Scraper
						if (stripos($workflowName, 'Github') !== false && stripos($workflowName, 'Scrapper') !== false) {
							$selectedOptions['githubScraper'] = true;
						}
						
						// Check for LinkedIn Messaging
						if (stripos($workflowName, 'Linkedin Messaging') !== false) {
							$selectedOptions['linkedinMessaging'] = true;
						}
						
						// Check for Social Media Posting
						if (stripos($workflowName, 'Social Media') !== false || stripos($workflowName, 'Post on') !== false) {
							// Parse params JSON to get which platforms are enabled
							if ($params) {
								// Handle if params is already a JSON string or an array
								if (is_string($params)) {
									$paramsArray = json_decode($params, true);
								} else {
									$paramsArray = $params;
								}
								
								if (is_array($paramsArray)) {
									$selectedOptions['linkedinPosting'] = isset($paramsArray['ln']) && $paramsArray['ln'] == '1';
									$selectedOptions['facebookPosting'] = isset($paramsArray['fb']) && $paramsArray['fb'] == '1';
									$selectedOptions['twitterPosting'] = isset($paramsArray['twitter']) && $paramsArray['twitter'] == '1';
								}
							}
						}
					}
				}
			} elseif (is_array($workflowResult) && count($workflowResult) > 0) {
				foreach ($workflowResult as $item) {
					if (is_array($item)) {
						$workflowName = isset($item['workflow_name']) ? $item['workflow_name'] : null;
						$params = isset($item['params']) ? $item['params'] : null;
						
						if ($workflowName) {
							if (stripos($workflowName, 'Linkedin Scraper') !== false) {
								$selectedOptions['linkedinScraper'] = true;
							}
							if (stripos($workflowName, 'Github') !== false && stripos($workflowName, 'Scrapper') !== false) {
								$selectedOptions['githubScraper'] = true;
							}
							if (stripos($workflowName, 'Linkedin Messaging') !== false) {
								$selectedOptions['linkedinMessaging'] = true;
							}
							if (stripos($workflowName, 'Social Media') !== false || stripos($workflowName, 'Post on') !== false) {
								if ($params) {
									if (is_string($params)) {
										$paramsArray = json_decode($params, true);
									} else {
										$paramsArray = $params;
									}
									if (is_array($paramsArray)) {
										$selectedOptions['linkedinPosting'] = isset($paramsArray['ln']) && $paramsArray['ln'] == '1';
										$selectedOptions['facebookPosting'] = isset($paramsArray['fb']) && $paramsArray['fb'] == '1';
										$selectedOptions['twitterPosting'] = isset($paramsArray['twitter']) && $paramsArray['twitter'] == '1';
									}
								}
							}
						}
					}
				}
			}
		}
		
		return [
			"success" => true,
			"campaign_exists" => $campaignExists,
			"campaign_id" => $campaignId,
			"selected_options" => $selectedOptions
		];
	} catch (Exception $e) {
		return [
			"success" => false,
			"error" => "Database query failed",
			"message" => $e->getMessage()
		];
	}
}

// Get profile table name dynamically (bi_t20s)
function get_profile_table_name() {
	// Static variable to cache in memory (works even if storage is not available)
	static $cachedTableName = null;
	
	// Check in-memory cache first
	if ($cachedTableName !== null) {
		return $cachedTableName;
	}
	
	// Try to get from storage cache (if available)
	try {
		$cachedTable = storage_get("profile_table_name", null);
		if ($cachedTable !== null) {
			$cachedTableName = $cachedTable; // Cache in memory too
			return $cachedTable;
		}
	} catch (Exception $e) {
		// Storage not available, continue
	}
	
	// Try to get from cached module_files data (if available)
	try {
		$moduleFiles = storage_get("module_files_staffing", null);
		if ($moduleFiles !== null && is_array($moduleFiles)) {
			foreach ($moduleFiles as $file) {
				// Look for profile or candidate related pages
				if (isset($file['pagename']) && (stripos($file['pagename'], 'profile') !== false || 
				    stripos($file['pagename'], 'candidate') !== false || 
				    stripos($file['pagename'], 'scrape') !== false || 
				    stripos($file['pagename'], 'lead') !== false)) {
					$filename = $file['filename'];
					$cachedTableName = $filename; // Cache in memory
					try {
						storage_set("profile_table_name", $filename); // Try to cache in storage
					} catch (Exception $e) {
						// Storage not available, continue
					}
					return $filename;
				}
			}
		}
	} catch (Exception $e) {
		// Storage not available, continue
	}
	
	// If not in cache, fetch from module_files table directly
	try {
		$sql = "SELECT filename, pagename FROM module_files WHERE module_name = 'staffing' AND (pagename LIKE '%lead%') LIMIT 1";
		$result = teamob_query($sql);
		
		// Handle different response formats
		$filename = null;
		
		if ($result && isset($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
			$data = $result['data'][0];
			$filename = isset($data['module_files']['filename']) ? $data['module_files']['filename'] : $data['filename'];
		} elseif (is_array($result) && count($result) > 0) {
			$data = $result[0];
			$filename = isset($data['filename']) ? $data['filename'] : null;
		}
		
		// If filename found, cache it and return
		if ($filename) {
			$cachedTableName = $filename; // Cache in memory
			try {
				storage_set("profile_table_name", $filename); // Try to cache in storage
			} catch (Exception $e) {
				// Storage not available, continue
			}
			return $filename;
		}
	} catch (Exception $e) {
		// On error, fallback to default table name
		error_log("Error fetching profile table name: " . $e->getMessage());
	}
	
	// Fallback to default table name if not found
	$defaultTable = "bi_t20s";
	$cachedTableName = $defaultTable; // Cache in memory
	try {
		storage_set("profile_table_name", $defaultTable); // Try to cache in storage
	} catch (Exception $e) {
		// Storage not available, continue
	}
	return $defaultTable;
}

// Get campaign features (workflow names) with profile counts for a given requirement
function get_campaign_features($params) {
	$requirementId = isset($params['requirement_id']) ? intval($params['requirement_id']) : 0;
	
	if ($requirementId === 0) {
		return [
			"success" => false,
			"error" => "Invalid requirement ID"
		];
	}
	
	// Get campaign ID first from workflow_campaigns
	$campaignStatus = get_campaign_status($params);
	if (!$campaignStatus['success'] || !$campaignStatus['campaign_exists'] || !$campaignStatus['campaign_id']) {
		return [
			"success" => false,
			"error" => "Campaign not found for this requirement"
		];
	}
	
	$campaignId = $campaignStatus['campaign_id'];
	
	// Query workflow_registry to get workflow names (features)
	// Exclude "Post on Social Media" from the results
	$workflowTable = "workflow_registry";
	$workflowSql = "SELECT workflow_name FROM $workflowTable WHERE campaign_id = $campaignId AND workflow_name != 'Post on Social Media'";
	
	try {
		$workflowResult = teamob_query($workflowSql);
		
		// Handle different response formats from teamob_query
		$features = [];
		
		if ($workflowResult && isset($workflowResult['data']) && is_array($workflowResult['data']) && count($workflowResult['data']) > 0) {
			foreach ($workflowResult['data'] as $item) {
				// Handle nested table name structure
				$keys = array_keys($item);
				if (count($keys) > 0 && isset($item[$keys[0]]['workflow_name'])) {
					$workflowName = $item[$keys[0]]['workflow_name'];
					if (!empty($workflowName) && stripos($workflowName, 'Post on Social Media') === false) {
						$features[] = $workflowName;
					}
				} elseif (isset($item['workflow_name'])) {
					$workflowName = $item['workflow_name'];
					if (!empty($workflowName) && stripos($workflowName, 'Post on Social Media') === false) {
						$features[] = $workflowName;
					}
				}
			}
		} elseif (is_array($workflowResult) && count($workflowResult) > 0) {
			foreach ($workflowResult as $item) {
				if (is_array($item)) {
					if (isset($item['workflow_name'])) {
						$workflowName = $item['workflow_name'];
						if (!empty($workflowName) && stripos($workflowName, 'Post on Social Media') === false) {
							$features[] = $workflowName;
						}
					} elseif (isset($item['workflow_registry'])) {
						$workflowName = $item['workflow_registry']['workflow_name'];
						if (!empty($workflowName) && stripos($workflowName, 'Post on Social Media') === false) {
							$features[] = $workflowName;
						}
					}
				}
			}
		}
		
		// Get profile counts grouped by source from profile table
		// Note: bi_t20s.campaign_id stores the requirement_id, not the workflow campaign ID
		$profileTable = get_profile_table_name();
		$profileSql = "SELECT `source`, COUNT(bi_primary_id) as profiles FROM $profileTable WHERE campaign_id = $requirementId GROUP BY `source`";
		
		$profileResult = teamob_query($profileSql);
		
		// DEBUG: Return raw results if debug parameter is set
		if (isset($_GET['debug']) && $_GET['debug'] == '1') {
			return [
				"success" => true,
				"debug" => true,
				"requirement_id" => $requirementId,
				"campaign_id" => $campaignId,
				"profile_table" => $profileTable,
				"profile_sql" => $profileSql,
				"profile_result_raw" => $profileResult,
				"features" => $features
			];
		}
		
		// Parse profile counts by source
		$profileCounts = [];
		
		// Handle different response formats from teamob_query
		if ($profileResult && isset($profileResult['data']) && is_array($profileResult['data']) && count($profileResult['data']) > 0) {
			// Format: {"status":"success","data":[{...}]}
			$dataArray = $profileResult['data'];
			
			foreach ($dataArray as $item) {
				$source = null;
				$count = 0;
				
				// Handle structure: {"bi_t20s": {"source": "Github"}, "0": {"profiles": "3"}}
				if (isset($item['bi_t20s']) && is_array($item['bi_t20s'])) {
					$source = isset($item['bi_t20s']['source']) ? $item['bi_t20s']['source'] : null;
				}
				
				// Get count from "0" key: {"0": {"profiles": "3"}}
				if (isset($item['0']) && is_array($item['0'])) {
					$count = isset($item['0']['profiles']) ? intval($item['0']['profiles']) : 0;
				}
				
				// Fallback: try other numeric keys
				if ($count == 0) {
					foreach ($item as $key => $value) {
						if (is_numeric($key) && is_array($value) && isset($value['profiles'])) {
							$count = intval($value['profiles']);
							break;
						}
					}
				}
				
				// Fallback: try direct access
				if ($source === null && isset($item['source'])) {
					$source = $item['source'];
				}
				if ($count == 0 && isset($item['profiles'])) {
					$count = intval($item['profiles']);
				}
				
				if ($source !== null) {
					$profileCounts[strtolower(trim($source))] = $count;
				}
			}
		} elseif (is_array($profileResult) && count($profileResult) > 0 && !isset($profileResult['data'])) {
			// Direct array format: [{source: "Linkedin", profiles: "1"}]
			foreach ($profileResult as $item) {
				if (is_array($item)) {
					$source = isset($item['source']) ? $item['source'] : null;
					$count = isset($item['profiles']) ? intval($item['profiles']) : 0;
					
					if ($source !== null) {
						$profileCounts[strtolower(trim($source))] = $count;
					}
				}
			}
		}
		
		// Match features with profile counts (workflow_name should match source)
		// Handle partial matches: "Linkedin Scraper" should match "Linkedin", "Github_Scrapper" should match "Github"
		$featuresWithCounts = [];
		foreach ($features as $feature) {
			$profiles = 0;
			$featureLower = strtolower(trim($feature));
			
			// Try exact match first
			if (isset($profileCounts[$featureLower])) {
				$profiles = $profileCounts[$featureLower];
			} else {
				// Try partial match - check if any source is contained in feature name or vice versa
				foreach ($profileCounts as $source => $count) {
					// Check if source is contained in feature (e.g., "linkedin" in "linkedin scraper")
					if (stripos($featureLower, $source) !== false || stripos($source, $featureLower) !== false) {
						$profiles = $count;
						break;
					}
					// Also check for common variations
					if (($source === 'linkedin' && stripos($featureLower, 'linkedin') !== false) ||
					    ($source === 'github' && stripos($featureLower, 'github') !== false)) {
						$profiles = $count;
						break;
					}
				}
			}
			
			$featuresWithCounts[] = [
				"feature" => $feature,
				"profiles" => $profiles
			];
		}
		
		return [
			"success" => true,
			"features" => $featuresWithCounts,
			"campaign_id" => $campaignId
		];
	} catch (Exception $e) {
		return [
			"success" => false,
			"error" => "Database query failed",
			"message" => $e->getMessage()
		];
	}
}

// Create campaign and workflow entries
function create_campaign($params) {
	$requirementId = isset($params['requirement_id']) ? intval($params['requirement_id']) : 0;
	
	if ($requirementId === 0) {
		return [
			"success" => false,
			"error" => "Invalid requirement ID"
		];
	}
	
	// Get requirement details
	$requirementTable = get_requirement_table_name();
	$reqSql = "SELECT bi_primary_id, requirement_name FROM $requirementTable WHERE bi_primary_id = $requirementId LIMIT 1";
	
	try {
		$reqResult = teamob_query($reqSql);
		
		// Parse requirement data
		$requirementName = null;
		if ($reqResult && isset($reqResult['data']) && is_array($reqResult['data']) && count($reqResult['data']) > 0) {
			$reqData = $reqResult['data'][0];
			if (isset($reqData['bi_t14s'])) {
				$requirementName = isset($reqData['bi_t14s']['requirement_name']) ? $reqData['bi_t14s']['requirement_name'] : null;
			} elseif (isset($reqData['requirement_name'])) {
				$requirementName = $reqData['requirement_name'];
			}
		} elseif (is_array($reqResult) && count($reqResult) > 0) {
			$reqData = $reqResult[0];
			$requirementName = isset($reqData['requirement_name']) ? $reqData['requirement_name'] : null;
		}
		
		if (!$requirementName) {
			return [
				"success" => false,
				"error" => "Requirement not found"
			];
		}
		
		// Check if campaign already exists
		$campaignStatus = get_campaign_status($params);
		if ($campaignStatus['success'] && $campaignStatus['campaign_exists']) {
			return [
				"success" => false,
				"error" => "Campaign already exists for this requirement"
			];
		}
		
		// Get selected posting options
		$linkedinPosting = isset($params['linkedinPosting']) && $params['linkedinPosting'] ? true : false;
		$facebookPosting = isset($params['facebookPosting']) && $params['facebookPosting'] ? true : false;
		$twitterPosting = isset($params['twitterPosting']) && $params['twitterPosting'] ? true : false;
		$linkedinScraper = isset($params['linkedinScraper']) && $params['linkedinScraper'] ? true : false;
		$githubScraper = isset($params['githubScraper']) && $params['githubScraper'] ? true : false;
		$linkedinMessaging = isset($params['linkedinMessaging']) && $params['linkedinMessaging'] ? true : false;
		
		// Check if at least one option is selected
		if (!$linkedinPosting && !$facebookPosting && !$twitterPosting && !$linkedinScraper && !$githubScraper && !$linkedinMessaging) {
			return [
				"success" => false,
				"error" => "Please select at least one posting option"
			];
		}
		
		// Escape requirement name for SQL
		$escapedRequirementName = addslashes($requirementName);
		$refTableName = "bi_t14s";
		$currentDate = date('Y-m-d');
		
		// Insert into workflow_campaigns
		$campaignSql = "INSERT INTO workflow_campaigns (campaign_name, ref_table_id, ref_table_name, status, start_date, created_at) 
			VALUES ('$escapedRequirementName', $requirementId, '$refTableName', 'active', '$currentDate', NOW())";
		
		$campaignResult = teamob_query($campaignSql);
		
		// Get the inserted campaign ID
		$campaignId = null;
		$getIdSql = "SELECT id FROM workflow_campaigns WHERE ref_table_id = $requirementId ORDER BY id DESC LIMIT 1";
		$idResult = teamob_query($getIdSql);
		
		if ($idResult && isset($idResult['data']) && is_array($idResult['data']) && count($idResult['data']) > 0) {
			$idData = $idResult['data'][0];
			if (isset($idData['workflow_campaigns'])) {
				$campaignId = isset($idData['workflow_campaigns']['id']) ? intval($idData['workflow_campaigns']['id']) : null;
			} elseif (isset($idData['id'])) {
				$campaignId = intval($idData['id']);
			}
		} elseif (is_array($idResult) && count($idResult) > 0) {
			$idData = $idResult[0];
			$campaignId = isset($idData['id']) ? intval($idData['id']) : null;
		}
		
		if (!$campaignId) {
			return [
				"success" => false,
				"error" => "Failed to create campaign"
			];
		}
		
		// Prepare workflow entries to insert
		$workflowEntries = [];
		
		// LinkedIn Scraper
		if ($linkedinScraper) {
			$workflowEntries[] = [
				'workflow_name' => 'Linkedin Scraper',
				'connector_name' => 'linkedin_scrap',
				'webhook_url' => 'http://automation.teamob.io:5678/webhook/cbbf7338-989c-44da-83da-99cf238e2de7'
			];
		}
		
		// Github Scraper
		if ($githubScraper) {
			$workflowEntries[] = [
				'workflow_name' => 'Github_Scrapper',
				'connector_name' => 'github_scrap',
				'webhook_url' => 'http://automation.teamob.io:5678/webhook/8b5fd351-b8eb-45b6-87af-c7e7d47fe964'
			];
		}
		
		// LinkedIn Messaging
		if ($linkedinMessaging) {
			$workflowEntries[] = [
				'workflow_name' => 'Linkedin Messaging',
				'connector_name' => 'linkedin_message',
				'webhook_url' => 'http://automation.teamob.io:5678/webhook/76cec9f7-a63f-4a11-aaf5-a2eec4acf087',
				'params' => null
			];
		}
		
		// Social Media Posting (if any posting option is selected)
		if ($linkedinPosting || $facebookPosting || $twitterPosting) {
			$socialParams = [
				'fb' => $facebookPosting ? '1' : '0',
				'ln' => $linkedinPosting ? '1' : '0',
				'insta' => '0',
				'twitter' => $twitterPosting ? '1' : '0'
			];
			$workflowEntries[] = [
				'workflow_name' => 'Post on Social Media',
				'connector_name' => 'social_media_post',
				'webhook_url' => 'http://automation.teamob.io:5678/webhook/2a74e18c-8f37-4abf-a8cd-25ff4477fe15',
				'params' => json_encode($socialParams)
			];
		}
		
		// Insert workflow entries
		$insertedWorkflows = [];
		foreach ($workflowEntries as $workflow) {
			$workflowName = addslashes($workflow['workflow_name']);
			$connectorName = addslashes($workflow['connector_name']);
			$webhookUrl = addslashes($workflow['webhook_url']);
			$params = isset($workflow['params']) && $workflow['params'] !== null ? addslashes($workflow['params']) : null;
			
			$paramsValue = $params !== null ? "'$params'" : "NULL";
			
			// Set depth_limit to 6 for LinkedIn Messaging, 2 for others
			$depthLimit = (stripos($workflowName, 'Linkedin Messaging') !== false) ? 6 : 2;
			
			$workflowSql = "INSERT INTO workflow_registry 
				(campaign_id, workflow_name, webhook_url, connector_name, params, last_page_fetched, depth_limit, interval_minutes, next_run_at, last_executed_at, is_active, priority, retry_count, created_at) 
				VALUES ($campaignId, '$workflowName', '$webhookUrl', '$connectorName', $paramsValue, 0, $depthLimit, 1440, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 5, 0, NOW())";
			
			$workflowResult = teamob_query($workflowSql);
			$insertedWorkflows[] = $workflow['workflow_name'];
		}
		
		return [
			"success" => true,
			"message" => "Campaign created successfully",
			"campaign_id" => $campaignId,
			"workflows" => $insertedWorkflows
		];
		
	} catch (Exception $e) {
		return [
			"success" => false,
			"error" => "Database operation failed",
			"message" => $e->getMessage()
		];
	}
}

function get_user_name($params) {
	$userId = isset($params['user_id']) ? intval($params['user_id']) : 0;

	if ($userId <= 0) {
		return [
			"success" => false,
			"error" => "Invalid user ID"
		];
	}

	$sql = "SELECT first_name, last_name FROM users WHERE user_id = $userId LIMIT 1";

	try {
		$result = teamob_query($sql);

		$firstName = null;
		$lastName = null;

		if ($result && isset($result['data']) && is_array($result['data']) && count($result['data']) > 0) {
			$data = $result['data'][0];
			if (isset($data['users'])) {
				$firstName = isset($data['users']['first_name']) ? $data['users']['first_name'] : null;
				$lastName = isset($data['users']['last_name']) ? $data['users']['last_name'] : null;
			} else {
				$firstName = isset($data['first_name']) ? $data['first_name'] : null;
				$lastName = isset($data['last_name']) ? $data['last_name'] : null;
			}
		} elseif (is_array($result) && count($result) > 0) {
			$data = $result[0];
			$firstName = isset($data['first_name']) ? $data['first_name'] : null;
			$lastName = isset($data['last_name']) ? $data['last_name'] : null;
		}

		if ($firstName || $lastName) {
			$fullName = trim(($firstName ? $firstName : '') . ' ' . ($lastName ? $lastName : ''));
			return [
				"success" => true,
				"full_name" => $fullName
			];
		}

		return [
			"success" => false,
			"error" => "User not found"
		];
	} catch (Exception $e) {
		return [
			"success" => false,
			"error" => "Database query failed",
			"message" => $e->getMessage()
		];
	}
}

// Routing logic
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Parse the request URI
$parsedUrl = parse_url($requestUri);
$path = isset($parsedUrl['path']) ? $parsedUrl['path'] : '';

// Remove query string and get path segments
$pathParts = explode('/', trim($path, '/'));
$pathParts = array_filter($pathParts);
$pathParts = array_values($pathParts); // Re-index array

// Check if this is the root path or base path - serve React app
if (empty($pathParts) || (count($pathParts) === 2 && $pathParts[0] === 'web' && $pathParts[1] === 'ai')) {
    // This is the root or /web/ai - serve React app
    // (Will be handled at the end of the file)
} else {
    // Check if this is an API request - look for /web/function pattern
    // Handle both /web/ai/web/get_users and /web/get_users
    $apiFunction = null;
    
    // Look for pattern: .../web/[known_api_function]
    // Find the last occurrence of 'web' followed by a known API function
    for ($i = count($pathParts) - 2; $i >= 0; $i--) {
        if ($pathParts[$i] === 'web' && isset($pathParts[$i + 1])) {
            $potentialFunction = $pathParts[$i + 1];
            // Check if this is a known API function
            if (isset($api[$potentialFunction])) {
                $apiFunction = $potentialFunction;
                break;
            }
        }
    }
    
    if ($apiFunction !== null) {
        // API function exists and is allowed
        $apiConfig = $api[$apiFunction];
        $allowedMethods = is_array($apiConfig['method']) ? $apiConfig['method'] : [$apiConfig['method']];
        
        // Check if method is allowed
        if (in_array($requestMethod, $allowedMethods)) {
            // Get request parameters
            $params = [];
            if ($requestMethod === 'POST') {
                $input = file_get_contents('php://input');
                $decoded = json_decode($input, true);
                $params = ($decoded !== null && $decoded !== false) ? $decoded : [];
            } else {
                $params = $_GET;
            }
            
            // Call the function
            header('Content-Type: application/json');
            try {
                $result = call_user_func($apiFunction, $params);
                echo json_encode($result);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => $e->getMessage()]);
            }
            exit;
        } else {
            http_response_code(405);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
    }
    // If we get here, it's not a valid API call, continue to serve React app
}

// Serve React app for all other requests
$buildPath = __DIR__ . '/build';
$indexFile = $buildPath . '/index.html';

// Check if requesting a static asset
if (preg_match('/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i', $path)) {
    // Remove /web/ai prefix if present to get the relative path
    $relativePath = preg_replace('#^/web/ai#', '', $path);
    $filePath = $buildPath . $relativePath;
    if (file_exists($filePath)) {
        // Set appropriate content type
        $ext = pathinfo($filePath, PATHINFO_EXTENSION);
        $contentTypes = [
            'js' => 'application/javascript',
            'css' => 'text/css',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'ico' => 'image/x-icon',
            'svg' => 'image/svg+xml',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
            'eot' => 'application/vnd.ms-fontobject'
        ];
        if (isset($contentTypes[$ext])) {
            header('Content-Type: ' . $contentTypes[$ext]);
        }
        readfile($filePath);
        exit;
    }
}

// Serve index.html for SPA routing
if (file_exists($indexFile)) {
    readfile($indexFile);
} else {
    http_response_code(404);
    echo "Build files not found. Please run 'npm run build' in the frontend folder.";
}
