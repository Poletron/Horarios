import { decodeHtmlEntities } from '../utils/HtmlUtils.js';

export default {
  props: {
    generatedSchedules: Object
  },
  
  data() {
    return {
      currentScheduleIndex: 0,
      daysOfWeek: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      dayProperties: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      timeSlots: [],
      displayFormat: 'list', // 'list' o 'grid'
      subjectColors: {} // Mapa para almacenar colores por asignatura
    };
  },
  
  created() {
    // Crear horarios de 7:00 AM a 9:00 PM
    const startHour = 7;
    const endHour = 21;
    
    for (let hour = startHour; hour < endHour; hour++) {
      this.timeSlots.push(`${hour}:00`);
      this.timeSlots.push(`${hour}:30`);
    }
  },
  
  watch: {
    // Cuando cambia el horario actual, asignar colores a las materias
    currentSchedule: {
      immediate: true,
      handler(schedule) {
        if (schedule) {
          this.assignColorsToSubjects(schedule);
        }
      }
    }
  },
  
  computed: {
    hasResults() {
      return this.generatedSchedules && 
             this.generatedSchedules.schedules && 
             this.generatedSchedules.schedules.length > 0;
    },
    
    hasErrors() {
      return this.generatedSchedules && 
             this.generatedSchedules.errors && 
             this.generatedSchedules.errors.length > 0;
    },
    
    totalSchedules() {
      return this.generatedSchedules?.schedules?.length || 0;
    },
    
    currentSchedule() {
      return this.hasResults ? this.generatedSchedules.schedules[this.currentScheduleIndex] : null;
    },
    
    totalCredits() {
      if (!this.currentSchedule) return 0;
      
      return this.currentSchedule.reduce((total, course) => {
        return total + (parseFloat(course.creditHourLow) || 0);
      }, 0);
    },
    
    scheduleMatrix() {
      if (!this.currentSchedule) return null;
      
      // Crear matriz vacía para la semana
      const matrix = {};
      this.dayProperties.forEach(day => {
        matrix[day] = {};
        this.timeSlots.forEach(slot => {
          matrix[day][slot] = [];
        });
      });
      
      // Rellenar con las clases
      this.currentSchedule.forEach(course => {
        course.section.meetingsFaculty.forEach(meeting => {
          if (!meeting.meetingTime) return;
          
          const mt = meeting.meetingTime;
          this.dayProperties.forEach((day, index) => {
            if (mt[day]) {
              // Encontrar slots que se superponen con esta clase
              const slots = this.getSlotsForClass(mt.beginTime, mt.endTime);
              slots.forEach(slot => {
                matrix[day][slot].push({
                  id: course.subjectId,
                  title: `${course.subject}${course.courseNumber}`,
                  fullTitle: course.courseTitle,
                  nrc: course.section.courseReferenceNumber,
                  section: course.section.sequenceNumber,
                  room: mt.room || 'N/A',
                  beginTime: this.formatTime(mt.beginTime),
                  endTime: this.formatTime(mt.endTime)
                });
              });
            }
          });
        });
      });
      
      return matrix;
    }
  },
  
  methods: {
    previousSchedule() {
      if (this.currentScheduleIndex > 0) {
        this.currentScheduleIndex--;
      }
    },
    
    nextSchedule() {
      if (this.currentScheduleIndex < this.totalSchedules - 1) {
        this.currentScheduleIndex++;
      }
    },
    
    formatTime(timeStr) {
      if (!timeStr) return '';
      
      const hours = parseInt(timeStr.substring(0, 2), 10);
      const minutes = timeStr.substring(2);
      
      return `${hours}:${minutes}`;
    },
    
    getSlotsForClass(beginTime, endTime) {
      // Convertir horarios a minutos desde medianoche
      const toMinutes = timeStr => {
        const hours = parseInt(timeStr.substring(0, 2), 10);
        const minutes = parseInt(timeStr.substring(2), 10);
        return hours * 60 + minutes;
      };
      
      const beginMinutes = toMinutes(beginTime);
      const endMinutes = toMinutes(endTime);
      
      // Encontrar qué slots de tiempo están cubiertos por esta clase
      return this.timeSlots.filter(slot => {
        const [slotHour, slotMinute] = slot.split(':').map(Number);
        const slotMinutes = slotHour * 60 + slotMinute;
        
        return beginMinutes <= slotMinutes && slotMinutes < endMinutes;
      });
    },
    
    getCoursesForDay(day) {
      if (!this.currentSchedule) return [];
      
      const courses = [];
      this.currentSchedule.forEach(course => {
        course.section.meetingsFaculty.forEach(meeting => {
          if (!meeting.meetingTime) return;
          
          const mt = meeting.meetingTime;
          if (mt[day]) {
            courses.push({
              id: course.subjectId,
              title: `${course.subject}${course.courseNumber}`,
              fullTitle: course.courseTitle,
              nrc: course.section.courseReferenceNumber,
              section: course.section.sequenceNumber,
              room: mt.room || 'N/A',
              beginTime: this.formatTime(mt.beginTime),
              endTime: this.formatTime(mt.endTime)
            });
          }
        });
      });
      
      // Ordenar por hora de inicio
      return courses.sort((a, b) => {
        return a.beginTime.localeCompare(b.beginTime);
      });
    },
    
    getMeetingDaysText(course) {
      if (!course || !course.section || !course.section.meetingsFaculty) {
        return '';
      }
      
      const days = [];
      
      course.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;
        
        const mt = meeting.meetingTime;
        if (mt.monday) days.push('Lun');
        if (mt.tuesday) days.push('Mar');
        if (mt.wednesday) days.push('Mié');
        if (mt.thursday) days.push('Jue');
        if (mt.friday) days.push('Vie');
        if (mt.saturday) days.push('Sáb');
        if (mt.sunday) days.push('Dom');
      });
      
      return days.join('/');
    },
    
    // Nuevo método para obtener el NRC correctamente
    getCourseNRC(course) {
      return course && course.section && course.section.courseReferenceNumber 
        ? course.section.courseReferenceNumber 
        : 'N/A';
    },

    getCellClasses(courses) {
      if (!courses || courses.length === 0) {
        return 'empty-cell';
      }
      
      // Si hay conflicto, usar clase de conflicto
      if (courses.length > 1) {
        return 'conflict-cell';
      }
      
      // Si es un solo curso, asignar el color correspondiente
      const colorClass = this.getCourseColorClass(courses[0]);
      return `course-cell ${colorClass}`;
    },
    
    toggleDisplayFormat() {
      this.displayFormat = this.displayFormat === 'list' ? 'grid' : 'list';
    },
    
    // Asignar colores a cada materia para la visualización en grilla
    assignColorsToSubjects(schedule) {
      this.subjectColors = {};
      
      if (!schedule) return;
      
      // Obtener IDs únicos de las materias
      const subjectIds = [...new Set(schedule.map(course => course.subjectId))];
      
      // Asignar un color a cada materia
      subjectIds.forEach((id, index) => {
        // Usar módulo para ciclar a través de los 10 colores disponibles
        const colorIndex = index % 10;
        this.subjectColors[id] = colorIndex;
      });
    },
    
    // Obtener la clase CSS para el color de una celda
    getCourseColorClass(course) {
      if (!course || !course.id) return '';
      
      // Obtener el índice de color asignado a esta materia
      const colorIndex = this.subjectColors[course.id];
      if (colorIndex === undefined) return '';
      
      return `course-color-${colorIndex}`;
    },

    // Vista de Grilla - Asegurar que el NRC se muestre en cada celda
    getCellContent(courses) {
      if (!courses || courses.length === 0) return '';
      
      return courses.map(course => {
        return `
          <div>
            <strong class="course-title">${course.title} - ${course.section}</strong>
            <div class="course-details">
              ${course.beginTime} - ${course.endTime}
            </div>
            <div class="text-muted small">
              NRC: ${course.nrc}
              ${course.room !== 'N/A' ? ' | Aula: ' + course.room : ''}
            </div>
          </div>
        `;
      }).join('');
    },
  },
  
  template: `
    <div class="schedule-results">
      <div v-if="hasErrors" class="alert alert-warning">
        <h4 class="alert-heading">Advertencias</h4>
        <ul>
          <li v-for="(error, index) in generatedSchedules.errors" :key="index">
            {{ error }}
          </li>
        </ul>
      </div>
      
      <div v-if="hasResults" class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h2 class="m-0">Horarios Posibles</h2>
          <div>
            <button @click="toggleDisplayFormat" class="btn btn-outline-secondary btn-sm me-2">
              {{ displayFormat === 'list' ? 'Ver como Grilla' : 'Ver como Lista' }}
            </button>
            <span class="badge bg-info">{{ currentScheduleIndex + 1 }} de {{ totalSchedules }}</span>
          </div>
        </div>
        
        <div class="card-body">
          <div class="mb-3 d-flex justify-content-between align-items-center">
            <button 
              @click="previousSchedule" 
              class="btn btn-outline-primary"
              :disabled="currentScheduleIndex === 0"
            >
              &laquo; Anterior
            </button>
            
            <div>
              <strong>Total de créditos: {{ totalCredits }}</strong>
            </div>
            
            <button 
              @click="nextSchedule" 
              class="btn btn-outline-primary"
              :disabled="currentScheduleIndex >= totalSchedules - 1"
            >
              Siguiente &raquo;
            </button>
          </div>
          
          <!-- Vista de Lista -->
          <div v-if="displayFormat === 'list'" class="schedule-list-view">
            <div v-for="(dayName, dayIndex) in daysOfWeek" :key="dayIndex" class="day-block mb-3">
              <h3 class="day-title">{{ dayName }}</h3>
              
              <div v-if="getCoursesForDay(dayProperties[dayIndex]).length === 0" class="text-muted">
                No hay clases programadas
              </div>
              
              <div v-else class="course-list">
                <div v-for="course in getCoursesForDay(dayProperties[dayIndex])" :key="course.id + course.beginTime" 
                     :class="['course-item p-2 mb-2 border rounded', getCourseColorClass(course)]">
                  <div class="d-flex justify-content-between">
                    <div>
                      <strong>{{ course.title }} - {{ course.section }}</strong> 
                      <span class="badge bg-secondary ms-1">NRC: {{ course.nrc }}</span>
                      <div>{{ course.fullTitle }}</div>
                      <div class="text-muted">
                        {{ course.beginTime }} - {{ course.endTime }}
                        <span v-if="course.room !== 'N/A'"> | Aula: {{ course.room }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Vista de Grilla -->
          <div v-else-if="displayFormat === 'grid'" class="schedule-grid-view table-responsive">
            <table class="table table-bordered">
              <thead>
                <tr>
                  <th class="time-header">Hora</th>
                  <th v-for="(day, index) in daysOfWeek" :key="index">{{ day }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="timeSlot in timeSlots" :key="timeSlot">
                  <td class="time-cell">{{ timeSlot }}</td>
                  <td v-for="(day, dayIndex) in dayProperties" :key="day" 
                      :class="getCellClasses(scheduleMatrix[day][timeSlot])">
                    <div v-for="course in scheduleMatrix[day][timeSlot]" :key="course.id">
                      <div v-if="scheduleMatrix[day][timeSlot].length > 0">
                        <strong class="course-title">{{ course.title }} - {{ course.section }}</strong>
                        <div class="badge bg-secondary mb-1">NRC: {{ course.nrc }}</div>
                        <div class="course-details">
                          {{ course.beginTime }} - {{ course.endTime }}
                        </div>
                        <div class="course-room" v-if="course.room !== 'N/A'">
                          Aula: {{ course.room }}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <!-- Leyenda de colores mejorada -->
            <div class="mt-3 p-2 bg-light rounded">
              <h5>Materias:</h5>
              <div class="d-flex flex-wrap">
                <div v-for="(colorIndex, subjectId) in subjectColors" :key="subjectId"
                    class="me-3 mb-2 d-flex align-items-center">
                  <div :class="['color-sample', 'course-color-' + colorIndex]"></div>
                  <span>{{ subjectId }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Resumen del horario actual -->
          <div class="mt-4 p-3 bg-light rounded">
            <h4>Resumen</h4>
            <div class="row">
              <div v-for="course in currentSchedule" :key="course.id" class="col-md-6 mb-2">
                <div class="schedule-summary-item">
                  <strong>{{ course.subject }}{{ course.courseNumber }} - {{ course.section.sequenceNumber }}</strong>
                  <div>{{ course.courseTitle }}</div>
                  <div class="text-muted">
                    {{ getMeetingDaysText(course) }} 
                  </div>
                  <div class="badge bg-secondary">NRC: {{ getCourseNRC(course) }}</div>
                  <span class="ms-2">{{ course.creditHourLow }} créditos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card-footer text-center">
          <button class="btn btn-success" @click="$emit('save-schedule', currentSchedule)">
            Guardar este horario
          </button>
        </div>
      </div>
      
      <div v-else-if="generatedSchedules && generatedSchedules.schedules && generatedSchedules.schedules.length === 0" class="alert alert-info">
        <h4 class="alert-heading">No se encontraron horarios válidos</h4>
        <p>No fue posible encontrar combinaciones de horarios sin conflictos para las materias seleccionadas.</p>
        <p>Prueba seleccionando diferentes materias o secciones.</p>
      </div>
      
      <div v-else-if="!generatedSchedules" class="text-center p-4">
        <p class="text-muted">Selecciona materias y genera horarios para ver resultados aquí.</p>
      </div>
    </div>
  `
};