import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import CourseList from './components/CourseList.js';
import SubjectSelector from './components/SubjectSelector.js';
import ScheduleResults from './components/ScheduleResults.js';

const app = createApp({
  components: {
    CourseList,
    SubjectSelector,
    ScheduleResults
  },
  
  data() {
    return {
      currentView: 'subject-selector', // 'subject-selector' o 'course-list'
      generatedSchedules: null
    };
  },
  
  methods: {
    handleSchedulesGenerated(schedules) {
      this.generatedSchedules = schedules;
    }
    // saveSchedule method removed as it's now handled in the ScheduleResults component
  },
  
  template: `
    <div>
      <header class="header">
        <h1>Planificador de Horarios UCAB</h1>
      </header>
      
      <div class="main-container">
        <div class="btn-group mb-4">
          <button 
            @click="currentView = 'subject-selector'" 
            :class="['btn', currentView === 'subject-selector' ? 'btn-primary' : 'btn-outline-primary']"
          >
            Generador de Horarios
          </button>
          <button 
            @click="currentView = 'course-list'" 
            :class="['btn', currentView === 'course-list' ? 'btn-primary' : 'btn-outline-primary']"
          >
            Lista de Cursos
          </button>
        </div>
        
        <div v-if="currentView === 'subject-selector'" class="row">
          <div class="col-lg-5">
            <subject-selector @schedules-generated="handleSchedulesGenerated" />
          </div>
          <div class="col-lg-7">
            <schedule-results 
              :generated-schedules="generatedSchedules"
            />
          </div>
        </div>
        
        <div v-else>
          <course-list></course-list>
        </div>
      </div>
    </div>
  `
});

app.mount('#app');
