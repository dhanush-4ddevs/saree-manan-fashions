// Indian Geographic Data Utility
// Contains official Indian states, districts, and PIN code validation

export interface IndianState {
  name: string;
  code: string;
  districts: string[];
}

export interface PinCodeData {
  pincode: string;
  state: string;
  district: string;
  city?: string;
}

// Official Indian States and Union Territories with their districts
export const INDIAN_STATES: IndianState[] = [
  {
    name: "Andhra Pradesh",
    code: "AP",
    districts: [
      "Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool",
      "Nellore", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram",
      "West Godavari", "YSR Kadapa"
    ]
  },
  {
    name: "Arunachal Pradesh",
    code: "AR",
    districts: [
      "Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang",
      "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding",
      "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai",
      "Pakke Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap",
      "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"
    ]
  },
  {
    name: "Assam",
    code: "AS",
    districts: [
      "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo",
      "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Goalpara",
      "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan",
      "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli",
      "Morigaon", "Nagaon", "Nalbari", "Dima Hasao", "Sivasagar", "Sonitpur",
      "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"
    ]
  },
  {
    name: "Bihar",
    code: "BR",
    districts: [
      "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur",
      "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj",
      "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj",
      "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur",
      "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur",
      "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul",
      "Vaishali", "West Champaran"
    ]
  },
  {
    name: "Chhattisgarh",
    code: "CG",
    districts: [
      "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur",
      "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela Pendra Marwahi",
      "Janjgir Champa", "Jashpur", "Kabirdham", "Kanker", "Kondagaon", "Korba",
      "Koriya", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh", "Raipur",
      "Rajnandgaon", "Sukma", "Surajpur", "Surguja"
    ]
  },
  {
    name: "Goa",
    code: "GA",
    districts: ["North Goa", "South Goa"]
  },
  {
    name: "Gujarat",
    code: "GJ",
    districts: [
      "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch",
      "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka",
      "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch",
      "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal",
      "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar",
      "Tapi", "Vadodara", "Valsad"
    ]
  },
  {
    name: "Haryana",
    code: "HR",
    districts: [
      "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram",
      "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh",
      "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa",
      "Sonipat", "Yamunanagar"
    ]
  },
  {
    name: "Himachal Pradesh",
    code: "HP",
    districts: [
      "Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul Spiti",
      "Mandi", "Shimla", "Sirmaur", "Solan", "Una"
    ]
  },
  {
    name: "Jharkhand",
    code: "JH",
    districts: [
      "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum",
      "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti",
      "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi",
      "Sahebganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"
    ]
  },
  {
    name: "Karnataka",
    code: "KA",
    districts: [
      "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
      "Bidar", "Chamarajanagar", "Chikballapur", "Chikkamagaluru", "Chitradurga",
      "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri",
      "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur",
      "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"
    ]
  },
  {
    name: "Kerala",
    code: "KL",
    districts: [
      "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
      "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
      "Thiruvananthapuram", "Thrissur", "Wayanad"
    ]
  },
  {
    name: "Madhya Pradesh",
    code: "MP",
    districts: [
      "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani",
      "Betul", "Bhind", "Bhopal", "Burhanpur", "Chachaura", "Chhatarpur",
      "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna",
      "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua",
      "Katni", "Khandwa", "Khargone", "Maihar", "Mandla", "Mandsaur", "Morena",
      "Narsinghpur", "Neemuch", "Niwari", "Panna", "Raisen", "Rajgarh", "Ratlam",
      "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur",
      "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain",
      "Umaria", "Vidisha"
    ]
  },
  {
    name: "Maharashtra",
    code: "MH",
    districts: [
      "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara",
      "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli",
      "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban",
      "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar",
      "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg",
      "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"
    ]
  },
  {
    name: "Manipur",
    code: "MN",
    districts: [
      "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West",
      "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl",
      "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"
    ]
  },
  {
    name: "Meghalaya",
    code: "ML",
    districts: [
      "East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "North Garo Hills",
      "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills",
      "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"
    ]
  },
  {
    name: "Mizoram",
    code: "MZ",
    districts: [
      "Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai",
      "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"
    ]
  },
  {
    name: "Nagaland",
    code: "NL",
    districts: [
      "Chumukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung",
      "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator", "Tseminyu",
      "Tuensang", "Wokha", "Zunheboto"
    ]
  },
  {
    name: "Odisha",
    code: "OR",
    districts: [
      "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack",
      "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur",
      "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha",
      "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada",
      "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"
    ]
  },
  {
    name: "Punjab",
    code: "PB",
    districts: [
      "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka",
      "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana",
      "Malerkotla", "Mansa", "Moga", "Mohali", "Muktsar", "Pathankot", "Patiala",
      "Rupnagar", "Sangrur", "Shaheed Bhagat Singh Nagar", "Tarn Taran"
    ]
  },
  {
    name: "Rajasthan",
    code: "RJ",
    districts: [
      "Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara",
      "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur",
      "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu",
      "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand",
      "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"
    ]
  },
  {
    name: "Sikkim",
    code: "SK",
    districts: ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim"]
  },
  {
    name: "Tamil Nadu",
    code: "TN",
    districts: [
      "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri",
      "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur",
      "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal",
      "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet",
      "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi",
      "Tiruchirappalli", "Tirunelveli", "Tirupattur", "Tiruppur", "Tiruvallur",
      "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
    ]
  },
  {
    name: "Telangana",
    code: "TG",
    districts: [
      "Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon",
      "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar",
      "Khammam", "Komaram Bheem", "Mahabubabad", "Mahabubnagar", "Mancherial",
      "Medak", "Medchal Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda",
      "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla",
      "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy",
      "Warangal Rural", "Warangal Urban", "Yadadri Bhuvanagiri"
    ]
  },
  {
    name: "Tripura",
    code: "TR",
    districts: [
      "Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura",
      "Unakoti", "West Tripura"
    ]
  },
  {
    name: "Uttar Pradesh",
    code: "UP",
    districts: [
      "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya",
      "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki",
      "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli",
      "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad",
      "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur",
      "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj",
      "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar",
      "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau",
      "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh",
      "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar",
      "Shahjahanpur", "Shamli", "Shrawasti", "Siddharthnagar", "Sitapur", "Sonbhadra",
      "Sultanpur", "Unnao", "Varanasi"
    ]
  },
  {
    name: "Uttarakhand",
    code: "UK",
    districts: [
      "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar",
      "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal",
      "Udham Singh Nagar", "Uttarkashi"
    ]
  },
  {
    name: "West Bengal",
    code: "WB",
    districts: [
      "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur",
      "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong",
      "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas",
      "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur",
      "Purulia", "South 24 Parganas", "Uttar Dinajpur"
    ]
  },
  // Union Territories
  {
    name: "Andaman and Nicobar Islands",
    code: "AN",
    districts: ["Nicobar", "North and Middle Andaman", "South Andaman"]
  },
  {
    name: "Chandigarh",
    code: "CH",
    districts: ["Chandigarh"]
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    code: "DN",
    districts: ["Dadra and Nagar Haveli", "Daman", "Diu"]
  },
  {
    name: "Delhi",
    code: "DL",
    districts: [
      "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi",
      "North West Delhi", "Shahdara", "South Delhi", "South East Delhi",
      "South West Delhi", "West Delhi"
    ]
  },
  {
    name: "Jammu and Kashmir",
    code: "JK",
    districts: [
      "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal",
      "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama",
      "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"
    ]
  },
  {
    name: "Ladakh",
    code: "LA",
    districts: ["Kargil", "Leh"]
  },
  {
    name: "Lakshadweep",
    code: "LD",
    districts: ["Lakshadweep"]
  },
  {
    name: "Puducherry",
    code: "PY",
    districts: ["Karaikal", "Mahe", "Puducherry", "Yanam"]
  }
];

// PIN code validation function
export const validatePinCode = (pincode: string): boolean => {
  // Indian PIN codes are 6 digits
  return /^\d{6}$/.test(pincode);
};

// Enhanced function to validate Indian PIN code patterns
export const isValidIndianPinCode = (pincode: string): boolean => {
  if (!validatePinCode(pincode)) {
    return false;
  }

  // Indian PIN codes follow specific patterns:
  // First digit represents postal region (1-8)
  // Some specific ranges are reserved or not in use
  const firstDigit = parseInt(pincode[0]);

  // Valid first digits for Indian PIN codes (1-8)
  if (firstDigit < 1 || firstDigit > 8) {
    return false;
  }

  // Additional validation for known invalid ranges
  // These are some commonly known invalid PIN code patterns
  const invalidPatterns = [
    /^000000$/, // All zeros
    /^111111$/, // All ones
    /^222222$/, // All twos
    /^333333$/, // All threes
    /^444444$/, // All fours
    /^555555$/, // All fives
    /^666666$/, // All sixes
    /^777777$/, // All sevens
    /^888888$/, // All eights
    /^999999$/, // All nines
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(pincode)) {
      return false;
    }
  }

  return true;
};

// Function to get state and district from PIN code
// This is a simplified version - in production, you'd use a comprehensive PIN code database
export const getLocationFromPinCode = async (pincode: string): Promise<PinCodeData | null> => {
  if (!validatePinCode(pincode)) {
    return null;
  }

  // This is a simplified mapping for demonstration
  // In production, you would use a comprehensive PIN code API or database
  const pinCodeMappings: { [key: string]: PinCodeData } = {
    // Major cities examples
    "110001": { pincode: "110001", state: "Delhi", district: "Central Delhi", city: "New Delhi" },
    "110002": { pincode: "110002", state: "Delhi", district: "Central Delhi", city: "New Delhi" },
    "110003": { pincode: "110003", state: "Delhi", district: "Central Delhi", city: "New Delhi" },
    "110004": { pincode: "110004", state: "Delhi", district: "Central Delhi", city: "New Delhi" },
    "110005": { pincode: "110005", state: "Delhi", district: "Central Delhi", city: "New Delhi" },

    "400001": { pincode: "400001", state: "Maharashtra", district: "Mumbai City", city: "Mumbai" },
    "400002": { pincode: "400002", state: "Maharashtra", district: "Mumbai City", city: "Mumbai" },
    "400003": { pincode: "400003", state: "Maharashtra", district: "Mumbai City", city: "Mumbai" },
    "400004": { pincode: "400004", state: "Maharashtra", district: "Mumbai City", city: "Mumbai" },
    "400005": { pincode: "400005", state: "Maharashtra", district: "Mumbai City", city: "Mumbai" },

    "560001": { pincode: "560001", state: "Karnataka", district: "Bengaluru Urban", city: "Bengaluru" },
    "560002": { pincode: "560002", state: "Karnataka", district: "Bengaluru Urban", city: "Bengaluru" },
    "560003": { pincode: "560003", state: "Karnataka", district: "Bengaluru Urban", city: "Bengaluru" },
    "560004": { pincode: "560004", state: "Karnataka", district: "Bengaluru Urban", city: "Bengaluru" },
    "560005": { pincode: "560005", state: "Karnataka", district: "Bengaluru Urban", city: "Bengaluru" },

    "600001": { pincode: "600001", state: "Tamil Nadu", district: "Chennai", city: "Chennai" },
    "600002": { pincode: "600002", state: "Tamil Nadu", district: "Chennai", city: "Chennai" },
    "600003": { pincode: "600003", state: "Tamil Nadu", district: "Chennai", city: "Chennai" },
    "600004": { pincode: "600004", state: "Tamil Nadu", district: "Chennai", city: "Chennai" },
    "600005": { pincode: "600005", state: "Tamil Nadu", district: "Chennai", city: "Chennai" },

    "700001": { pincode: "700001", state: "West Bengal", district: "Kolkata", city: "Kolkata" },
    "700002": { pincode: "700002", state: "West Bengal", district: "Kolkata", city: "Kolkata" },
    "700003": { pincode: "700003", state: "West Bengal", district: "Kolkata", city: "Kolkata" },
    "700004": { pincode: "700004", state: "West Bengal", district: "Kolkata", city: "Kolkata" },
    "700005": { pincode: "700005", state: "West Bengal", district: "Kolkata", city: "Kolkata" },

    "500001": { pincode: "500001", state: "Telangana", district: "Hyderabad", city: "Hyderabad" },
    "500002": { pincode: "500002", state: "Telangana", district: "Hyderabad", city: "Hyderabad" },
    "500003": { pincode: "500003", state: "Telangana", district: "Hyderabad", city: "Hyderabad" },
    "500004": { pincode: "500004", state: "Telangana", district: "Hyderabad", city: "Hyderabad" },
    "500005": { pincode: "500005", state: "Telangana", district: "Hyderabad", city: "Hyderabad" },

    "411001": { pincode: "411001", state: "Maharashtra", district: "Pune", city: "Pune" },
    "411002": { pincode: "411002", state: "Maharashtra", district: "Pune", city: "Pune" },
    "411003": { pincode: "411003", state: "Maharashtra", district: "Pune", city: "Pune" },
    "411004": { pincode: "411004", state: "Maharashtra", district: "Pune", city: "Pune" },
    "411005": { pincode: "411005", state: "Maharashtra", district: "Pune", city: "Pune" },

    "380001": { pincode: "380001", state: "Gujarat", district: "Ahmedabad", city: "Ahmedabad" },
    "380002": { pincode: "380002", state: "Gujarat", district: "Ahmedabad", city: "Ahmedabad" },
    "380003": { pincode: "380003", state: "Gujarat", district: "Ahmedabad", city: "Ahmedabad" },
    "380004": { pincode: "380004", state: "Gujarat", district: "Ahmedabad", city: "Ahmedabad" },
    "380005": { pincode: "380005", state: "Gujarat", district: "Ahmedabad", city: "Ahmedabad" },

    "302001": { pincode: "302001", state: "Rajasthan", district: "Jaipur", city: "Jaipur" },
    "302002": { pincode: "302002", state: "Rajasthan", district: "Jaipur", city: "Jaipur" },
    "302003": { pincode: "302003", state: "Rajasthan", district: "Jaipur", city: "Jaipur" },
    "302004": { pincode: "302004", state: "Rajasthan", district: "Jaipur", city: "Jaipur" },
    "302005": { pincode: "302005", state: "Rajasthan", district: "Jaipur", city: "Jaipur" },

    "226001": { pincode: "226001", state: "Uttar Pradesh", district: "Lucknow", city: "Lucknow" },
    "226002": { pincode: "226002", state: "Uttar Pradesh", district: "Lucknow", city: "Lucknow" },
    "226003": { pincode: "226003", state: "Uttar Pradesh", district: "Lucknow", city: "Lucknow" },
    "226004": { pincode: "226004", state: "Uttar Pradesh", district: "Lucknow", city: "Lucknow" },
    "226005": { pincode: "226005", state: "Uttar Pradesh", district: "Lucknow", city: "Lucknow" },

    // Add more PIN codes as needed
    // For production, integrate with India Post API or similar service
  };

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return pinCodeMappings[pincode] || null;
};

// Function to get districts for a state
export const getDistrictsForState = (stateName: string): string[] => {
  const state = INDIAN_STATES.find(s => s.name === stateName);
  return state ? state.districts : [];
};

// Function to get all state names
export const getAllStateNames = (): string[] => {
  return INDIAN_STATES.map(state => state.name).sort();
};

// Function to validate if a district belongs to a state
export const isValidDistrictForState = (stateName: string, districtName: string): boolean => {
  const districts = getDistrictsForState(stateName);
  return districts.includes(districtName);
};
