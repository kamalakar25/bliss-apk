const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Shop = require('../models/SpSchema');

// login both user and admin

router.post('/login', async (req, res) => {
    const { identifier, password, role } = req.body;

    if (!identifier || !password || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const Model = role === 'User' ? User : Shop;

        // Search by either email or phone number
        const user = await Model.findOne({
            $or: [
                { email: identifier },
                { phone: identifier }
            ]
        });

        if (!user) {
            return res.status(401).json({ message: `${role} not found` });
        }

        // If role is not User and not approved
        if (role !== 'User' && user.approvals === false) {
            return res.status(401).json({ message: 'Your account is pending approval. Please wait for approval.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if(role === 'User'){
            user.login = true;
            await user.save();
        }
       

        res.status(200).json({
            email : user.email,
            message: `${role} logged in successfully`,
            // token
        });

    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// chek login
router.get('/check/login/:email', async (req, res) => {
    try {
      const { email } = req.params;
      const user = await User.findOne({ email });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      res.status(200).json({ loginData: user.login });
    } catch (err) {
      console.error('Error during login check:', err);  // Log more specific error
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });
  
// Register route
router.post('/register', async (req, res) => {
    try {
        const {
            name,
            email,
            gender,
            phone,
            dob,
            designation,
            password,
            bookings 
        } = req.body;

        // Create new user
        const newUser = new User({
            name,
            email,
            gender,
            phone,
            dob,
            designation,
            password,
            bookings 
        });

        // Save user
        await newUser.save();

        res.status(201).json({ message: ' registered successfully' });
    } catch (err) {
        console.error(err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(400).json({ error: `${field} already exists` });
        }
        res.status(500).json({ error: 'Server error' });
    }
});




// POST /api/users/:email/bookings - Add a booking for a specific user
router.post('/:email/bookings', async (req, res) => {
    try {
      const { email } = req.params;
      const {
        parlorEmail,
        parlorName,
        name,
        date,
        time,
        service,
        amount,
        relatedServices,
        favoriteEmployee,
      } = req.body;
  
      // Validate required fields
      if (!parlorEmail || !parlorName || !name || !date || !time || !service || !amount) {
        return res.status(400).json({ error: 'All required fields must be provided' });
      }
  
      // Find the user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Create new booking data
      const bookingData = {
        parlorEmail,
        parlorName,
        name,
        date,
        time,
        service,
        amount,
        relatedServices: relatedServices || [], // Default to empty array
        favoriteEmployee: favoriteEmployee || '', // Default to empty string
        createdAt: new Date(),
      };
  
      // Push the new booking data into the bookings array
      user.bookings.push(bookingData);
  
      // Save the updated user document
      await user.save();
  
      res.status(201).json({
        message: 'Booking added successfully',
        booking: user.bookings[user.bookings.length - 1], // Return the newly added booking
      });
    } catch (err) {
      console.error('Error adding booking:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  router.get('/all/bookings', async (req, res) => {
    try {
      const users = await User.find({}, 'bookings'); // Only fetch the bookings field
      const allBookings = users.flatMap(user => user.bookings || []);
      console.log(allBookings);
      
      res.status(200).json({ bookings: allBookings });
    } catch (err) {
      console.error('Error fetching all user bookings:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  

  // get bookins
  router.get('/bookings/:email', async (req, res) => {
    try {
      const { email } = req.params;
  
      // Find the user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      res.status(200).json({ bookings: user.bookings });
    } catch (err) {
      console.error('Error fetching bookings:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

router.get('/role/:email', async (req, res) => {
  const email = req.params.email;

  try {
    const user = await Shop.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ role: user.designation });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



router.get('/cards/services', async (req, res) => {
  try {
      const shops = await Shop.find({}, 'services shopName location designation email'); // fetch needed fields

      const filteredServices = shops.flatMap(shop =>
          shop.services.map(service => ({
              shopName: shop.shopName,
              style: service.style,
              serviceName: service.serviceName,
              price: service.price,
              rating: service.rating,
              shopImage: service.shopImage,
              email: shop.email,
              designation: shop.designation,
              location: shop.location
          }))
      );

      res.status(200).json(filteredServices);
  } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
  }
});






// Admin dashboard route

// GET all users (only selected fields)
router.get('/get/all/users', async (req, res) => {
  try {
      const users = await User.find({}, 'name email phone gender dob createdAt');
      res.status(200).json(users);
  } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ message: 'Server error' });
  }
});


// DELETE a user by ID
router.delete('/:id', async (req, res) => {
  try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ message: 'Server error' });
  }
});


// GET bookings for a specific parlor (based on parlorEmail inside booking)
router.get('/sp/bookings/:email', async (req, res) => {
  const { email } = req.params;

  try {
    // Fetch only users who have at least one booking with matching parlorEmail
    const users = await User.find({}, 'name email bookings');

    // Filter and flatten bookings that match the parlor email
    const filteredBookings = users.flatMap(user =>
      user.bookings
        .filter(booking => booking.parlorEmail === email && booking.paymentStatus === 'PAID')
        .map(booking => ({
          customerName: user.name,
          customerEmail: user.email,
          ...booking.toObject()
        }))
    );


    res.json(filteredBookings);
  } catch (error) {
    console.error('Error fetching filtered bookings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



router.get('/coustomer/bookings/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json([
      {
        name: user.name,
        bookings: user.bookings
      }
    ]);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT or POST route to update rating/review of a specific booking
router.post('/update/booking/rating', async (req, res) => {
  try {
    const { email, orderId, userRating, userReview } = req.body;

    const user = await User.findOneAndUpdate(
      { email, "bookings.orderId": orderId },
      {
        $set: {
          "bookings.$.userRating": userRating,
          "bookings.$.userReview": userReview,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User or Booking not found' });
    }

    res.status(200).json({ message: 'Review Update Successfully' });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// PUT route to update booking confirmation
router.put('/update-confirmation', async (req, res) => {
  const { email, bookingId } = req.body;
  console.log("email", email, "bookingId", bookingId, );

  try {
    // Find all users
    const users = await User.find({});

    let bookingUpdated = false;

    for (const user of users) {
      const booking = user.bookings.find(
        b => b.parlorEmail === email && b._id.toString() === bookingId
      );

      if (booking) {
        booking.confirmed = "confirmed";
        await user.save();
        bookingUpdated = true;
        break; // stop after first match (if only one expected)
      }
    }

    if (bookingUpdated) {
      res.status(200).json({ message: 'Booking confirmation updated successfully' });
    } else {
      res.status(404).json({ message: 'Booking not found' });
    }

  } catch (error) {
    console.error('Error updating booking confirmation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST route to submit a complaint for SP 
router.post('/submit-complaint', async (req, res) => {
  const { email, bookingId, complaint } = req.body;
  console.log("email:", email, "bookingId:", bookingId, "complaint:", complaint);

  try {
    // Validate input
    if (!email || !bookingId || !complaint || complaint.trim() === '') {
      return res.status(400).json({ message: 'Email, bookingId, and complaint are required' });
    }

    // Find all users
    const users = await User.find({});

    let bookingUpdated = false;

    for (const user of users) {
      const booking = user.bookings.find(
        b => b.parlorEmail === email && b._id.toString() === bookingId
      );

      if (booking) {
        // Add or update complaint field
        booking.spComplaint = complaint;
        await user.save();
        bookingUpdated = true;
        break; // Stop after first match
      }
    }

    if (bookingUpdated) {
      res.status(200).json({ message: 'Complaint submitted successfully' });
    } else {
      res.status(404).json({ message: 'Booking not found' });
    }

  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// PUT or POST route to update complaint of users
router.post('/update/booking/complaint', async (req, res) => {
  try {
    const { email, orderId, userComplaint } = req.body;

    const user = await User.findOneAndUpdate(
      { email, "bookings.orderId": orderId },
      {
        $set: {
          "bookings.$.userComplaint": userComplaint,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User or Booking not found' });
    }

    res.status(200).json({ message: 'Complaint Update Successfully' });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Get all complaints
router.get('/get/all/complaints', async (req, res) => {
  try {
    const users = await User.find({}, 'name email bookings');

    const userComplaints = [];
    const spComplaints = [];

    users.forEach(user => {
      user.bookings.forEach(booking => {
        if (booking.userComplaint) {
          userComplaints.push({
            parlorName: booking.parlorName,
            parlorEmail: booking.parlorEmail,
            userName: user.name,
            email: user.email,
            complaint: booking.userComplaint,
            date: booking.date,
            service: booking.service
          });
        }
        if (booking.spComplaint) {
          spComplaints.push({
            userEmail: user.email,
            spName: booking.parlorName,
            userEmail: user.email,
            email: booking.parlorEmail,
            complaint: booking.spComplaint,
            date: booking.date,
            service: booking.service
          });
        }
      });
    });

    res.json({ userComplaints, spComplaints });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;

